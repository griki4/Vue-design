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
                        name: chars.join('')
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