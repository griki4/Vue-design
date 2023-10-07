// 定义有限状态自动机
const State = {
    initial: 1, // 初始状态
    tagOpen: 2, // 标签开始状态
    tagName: 3, // 标签名称状态
    text: 4, // 文本状态
    tagEnd: 5, // 结束标签状态
    tagEndName: 6 // 结束标签名称状态
}
// 辅助函数，判断字符是否是字母
function isAlpha(char) {
    return char >= 'a' && char <= 'z' || char >= 'A' && char <= 'Z'
}

// 将字符串模板切割为token数组
function tokenize(str) {
    // 定义状态机的初始状态
    let currentState = State.initial
    // 缓存字符
    const chars = []
    // 存储最终生成的token
    const tokens = []
    while (str) {
        // 查看而非
        const char = str[0]
        // 匹配状态机的当前状态，状态的状态会发生改变
        switch (currentState) {
            case State.initial:
                if (char === '<') {
                    // 切换状态机状态并消费当前字符
                    currentState = State.tagOpen
                    str = str.slice(1)
                } else if (isAlpha(char)) {
                    // 切换到文本状态
                    currentState = State.text
                    // 将字母缓存
                    chars.push(char)
                    str = str.slice(1)
                }
                break
            case State.tagOpen:
                if (isAlpha(char)) {
                    // 切换到标签名称状态
                    currentState = State.tagName
                    chars.push(char)
                    str = str.slice(1)
                } else if (char === '/') {
                    // 切换到结束标签状态
                    currentState = State.tagEnd
                    str = str.slice(1)
                }
                break
            case State.tagName:
                if (isAlpha(char)) {
                    // 说明还处于标签名称状态中，无需切换
                    chars.push(char)
                    str = str.slice(1)
                } else if (char === '>') {
                    // 说明遇到了一个完整的标签
                    currentState = State.initial
                    // 创建标签token并放入tokens数组中，chars数组中缓存的就是标签的名字
                    tokens.push({
                        type: 'tag',
                        name: chars.join('')
                    })
                    chars.length = 0
                    str = str.slice(1)
                }
                break
            case State.text:
                if (isAlpha(char)) {
                    // 遇到字母继续缓存
                    chars.push(char)
                    str = str.slice(1)
                } else if (char === '<') {
                    currentState = State.tagOpen
                    // 遇到标签开始标志说明之前的内容是一个完整的文本
                    tokens.push({
                        type: 'text',
                        content: chars.join('')
                    })
                    chars.length = 0
                    str = str.slice(1)
                }
                break
            case State.tagEnd:
                if (isAlpha(char)) {
                    currentState = State.tagEndName
                    chars.push(char)
                    str = str.slice(1)
                }
                break
            case State.tagEndName:
                if (isAlpha(char)) {
                    chars.push(char)
                    str = str.slice(1)
                } else if (char === '>') {
                    currentState = State.initial
                    tokens.push({
                        type: 'tagEnd',
                        name: chars.join('')
                    })
                    chars.length = 0
                    str = str.slice(1)
                }
                break
        }
    }
    return tokens
}

// 根据模板字符串生成模板AST
function parse(str) {
    // 获取tokens数组
    const tokens = tokenize(str)
    // 创建根节点
    const root = {
        type: 'Root',
        children: []
    }
    // 创建用于维护父子元素关系的栈
    const elementStack = [root]
    while (tokens.length) {
        // 取栈顶元素作为父元素
        const parent = elementStack[elementStack.length - 1]
        const t = tokens[0]
        switch (t.type) {
            case 'tag':
                // 创建一个新的节点
                const elementNode = {
                    type: 'Element',
                    tag: t.name,
                    children: []
                }
                // 作为父元素的子节点插入
                parent.children.push(elementNode)
                // 压入栈
                elementStack.push(elementNode)
                break
            case 'text':
                // 创建文本节点
                const textNode = {
                    type: 'Text',
                    content: t.content
                }
                parent.children.push(textNode)
                break
            case 'tagEnd':
                // 弹出栈顶元素
                elementStack.pop()
                break
        }
        // 消费当前token
        tokens.shift()
    }
    return root
}

const ast = parse(`<div><p>Vue</p><p>Template</p></div>`)
console.log(ast)

// dump函数用于展示结果
function dump(node, indent = 0) {
    const type = node.type
    // 根节点不描述；标签使用标签名称描述；文本使用文本内容描述
    const desc = node.type === 'Root'
        ? ''
        : node.type === 'Element'
            ? node.tag
            : node.content
    // 打印节点的类型和描述
    console.log(`${'-'.repeat(indent)}${type}: ${desc}`)
    // 递归打印子节点
    if (node.children) {
        node.children.forEach(n => dump(n, indent + 2))
    }
}

// 深度优先遍历AST，能够访问到AST中的节点
// context上下文参数，使得AST转换函数可以共享数据
function traverseNode(ast, context) {
    // context存储当前转换节点
    context.currentNode = ast
    // 增加一个存储退出阶段函数的数组
    const exitFns = []
    // context.transforms是一个数组，包含多个回调函数
    const transforms = context.nodeTransforms
    // 依次执行回调函数
    for (let i = 0; i < transforms.length; i++) {
        const onExit = transforms[i](context.currentNode, context)
        // 进入阶段的函数的返回值就是退出阶段需要执行的函数
        if (onExit) {
            exitFns.push(onExit)
        }
        // 执行玩回调函数后需要检查context.currentNode是否还存在，因为可能会有移除节点操作
        if (!context.currentNode) return
    }
    // 递归访问子节点
    const children = context.currentNode.children
    if (children) {
        for (let i = 0; i < children.length; i++) {
            // 遍历子节点之前先更新上下文信息
            context.parent = context.currentNode
            context.childIndex = i
            traverseNode(children[i], context)
        }
    }

    // 在退出阶段，反向执行exitFns中的函数
    let i = exitFns.length
    while (i--) {
        exitFns[i]()
    }
}

function transform(ast) {
    const context = {
        // 当前正在转换的节点
        currentNode: null,
        // 当前正在转换的节点在父节点中的索引位置
        childIndex: 0,
        // 当前正在转换的节点的父节点
        parent: null,
        // 节点替换函数
        replaceNode(node) {
            // 寻找当前节点在父节点中的位置，使用新节点进行替换
            context.parent.children[context.childIndex] = node
            // 更改当前正在转换的节点
            context.currentNode = node
        },
        removeNode() {
            if (context.parent) {
              // splice方法移除当前访问到的节点
              context.parent.children.splice(context.childIndex, 1)
              context.currentNode = null
            }
        },
        // 用于转换节点的回调函数
        nodeTransforms: [
            transformText
        ]
    }
    traverseNode(ast, context)
    dump(ast)
}

function transformText(node, context) {
    if (node.type === 'Text') {
        context.replaceNode({
            type: 'Element',
            tag: 'span'
        })
    }
}

transform(ast)