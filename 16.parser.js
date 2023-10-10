// 定义文本模式状态表。不同状态下解析器对标签解析和HTML实体的支持有所不同。
const TextModes = {
    DATA: 'DATA',
    RCDATA: 'RCDATA',
    RAWTEXT: 'RAWTEXT',
    CDATA: 'CDATA'
}
// 解析器函数
function parse(str) {
    // 上下文对象
    const context = {
        // source表示需要被解析的字符串模板
        source: str,
        // mode表示解析的状态
        mode: TextModes.DATA,
        advanceBy(num) {
            context.source = context.source.slice(num)
        },
        // 消费空白和换行字符
        advanceSpaces() {
            const match = /^[\t\r\n\f ]+/.exec(context.source)
            if (match) {
                context.advanceBy(match[0].length)
            }
        }
    }
    // 调用parseChildren函数解析。
    // 第一个参数是上下文对象，第二个是父节点栈，初始为空
    const nodes = parseChildren(context,  [])
    return {
        type: 'Root',
        children: nodes
    }
}
function parseChildren(context, ancestors) {
    // 存储最终解析的结果
    const nodes = []
    const { source, mode } = context
    // 循环读取字符串模板
    while (!isEnd(context, ancestors)) {
        let node
        if (mode === TextModes.DATA || mode === TextModes.RCDATA) {
            if (mode === TextModes.DATA && source[0] === '<') {
                if (source[1] === '!') {
                    if (source.startsWith('<!--')) {
                        node = parseComment(context)
                    } else if (source.startsWith('<!CDATA[')) {
                        node = parseCDATA(context, ancestors)
                    }
                } else if (source[1] === '/') {

                } else if (/[a-z]/i.test(source[1])) {
                    node = parseElement(context, ancestors)
                }
            } else if (source.startsWith('{{')) {
                node = parseInterpolation(context)
            }
        }
        // node不存在则按文本处理
        if (!node) {
            node = parseText(contex)
        }
        nodes.push(node)
    }
    return nodes
}
// 当节点栈中存在开启状态机的标签同名的结束标签时停止状态机
function isEnd(context, ancestors) {
    if (!context.source) return true
    // 优化错误处理，栈中有匹配的标签则关闭状态机
    for (let i = ancestors.length - 1; i>= 0; i++) {
        if (context.source.startsWith(`</${ancestors[i].tag}`)) {
            return true
        }
    }
}
// parseElement函数会递归调用parseChildren函数解析子节点
function parseElement(context, ancestors) {
    // 解析开始标签
    const element = parseTag(context)
    // 自闭和标签直接返回开始标签解析结果
    if (element.isSelfClosing) return element
    // 根据开始标签的解析结果切换文本模式
    if (element.tag === 'textarea' || element.tag === 'title') {
        context.mode = TextModes.RCDATA
    } else if (/style|xmp|iframe|noembed|noframes|noscript/.test(element.tag)) {
        context.mode = TextModes.RAWTEXT
    } else {
        context.mode = TextModes.DATA
    }

    ancestors.push(element)
    // 解析子节点
    element.children = parseChildren(context, ancestors)
    ancestors.pop()
    // 解析结束标签
    if (context.source.startsWith(`</${element.tag}`)) {
        parseTag(context, 'end')
    } else {
        // 缺少闭合标签
        console.error(`${element.tag} 缺少闭合标签`)
    }
    return element
}

// 解析标签节点
function parseTag(context, type='start') {
    const { advanceBy, advanceSpaces } = context
    const match = type === 'start'
        ? /^<([a-z][^\t\r\n\f />]*)/i.exec(context.source)
        : /^<\/([a-z][^\t\r\n\f />]*)/i.exec(context.source)
    const tag = match[1] //标签名
    advanceBy(match[0].length)
    advanceSpaces()
    // 消费开始部分和空白之后，解析标签的属性
    const props = parseAttributes(context)
    // 关于自闭合标签
    const isSelfClosing = context.source.startsWith('/>')
    advanceBy(isSelfClosing ? 2 : 1)

    return {
        type: 'Element',
        tag,
        props,
        children: [],
        isSelfClosing
    }
}
// 解析标签属性
function parseAttributes(context) {
    const { advanceBy, advanceSpaces } = context
    const props = []
    while (!context.source.startsWith('>') && !context.source.startsWith('/>')) {
        const match = /^[^\t\r\n\f />][^\t\r\n\f />=]*/.exec(context.source)
        const name = match[0]
        advanceBy(name.length)
        advanceSpaces()
        advanceBy(1)
        advanceSpaces()
        // 获取属性值
        let value = ''
        const quote = context.source[0]
        const isQuoted = quote === '"' || quote === "'"
        if (isQuoted) {
            advanceBy(1)
            const endQuoteIndex = context.source.indexOf(quote)
            if (endQuoteIndex > -1) {
                value = context.source.slice(0, endQuoteIndex)
                advanceBy(value.length)
                advanceBy(1)
            } else {
                console.error('缺少引号')
            }
        } else {
            const match = /^[^\t\r\n\f >]+/.exec(context.source)
            value = match[0]
            advanceBy(value.length)
        }
        advanceSpaces()

        props.push({
            type: 'Attribute',
            name,
            value
        })
    }
    return props
}
// 解析文本节点
function parseText(context) {
    let endIndex = context.source.length
    const ltIndex = context.source.indexOf('<')
    const delimiterIndex = context.source.indexOf('{{')
    // 选取两者中较小的作为文本的结束位置
    if (ltIndex > -1 && ltIndex < delimiterIndex) {
        endIndex = ltIndex
    }
    if (delimiterIndex > -1 && delimiterIndex < ltIndex) {
        endIndex = delimiterIndex
    }
    const content =  context.source.slice(0, endIndex)
    context.advanceBy(content.length)
    return {
        type: 'Text',
        content
    }
}
// 解析文本差值
function parseInterpolation(context) {
    context.advanceBy('{{'.length)
    const closeIndex = context.source.indexOf('}}')
    if (closeIndex < 0) {
        console.error('缺少结束界定内容')
    }
    const content = context.source.slice(0, closeIndex)
    context.advanceBy(content.length)
    context.advanceBy('}}'.length)
    return {
        type: 'Interpolation',
        content: {
            type: 'Expression',
            content
        }
    }
}
// 解析注释节点
function parseComment(context) {
    context.advanceBy('<!--'.length)
    const closeIndex = context.source.indexOf('-->')
    const content = context.source.slice(0, closeIndex)
    context.advanceBy(content.length)
    context.advanceBy('-->'.length)
    return {
        type: 'Comment',
        content
    }
}

// 解析HTML实体
function decodeHtml(rawText, asAttr = false) {
    // 省略部分代码
    // 消费字符串，直到处理完毕为止
    while (offset < end) {
        // 省略部分代码
        // 如果满足条件，则说明是命名字符引用，否则为数字字符引用
        if (head[0] === '&') {
            // 省略部分代码
        } else {
            // 判断是十进制表示还是十六进制表示
            const hex = head[0] === '&#x'
            // 根据不同进制表示法，选用不同的正则
            const pattern = hex ? /^&#x([0-9a-f]+);?/i : /^&#([0-9]+);?/
            // 最终，body[1] 的值就是 Unicode 码点
            const body = pattern.exec(rawText)
            // 如果匹配成功，则调用 String.fromCodePoint 函数进行解码
            if (body) {
                // 根据对应的进制，将码点字符串转换为数字
                let cp = Number.parseInt(body[1], hex ? 16 : 10)
                // 码点的合法性检查
                if (cp === 0) {
                    // 如果码点值为 0x00，替换为 0xfffd
                    cp = 0xfffd
                } else if (cp > 0x10ffff) {
                    // 如果码点值超过 Unicode 的最大值，替换为 0xfffd
                    cp = 0xfffd
                } else if (cp >= 0xd800 && cp <= 0xdfff) {
                    // 如果码点值处于 surrogate pair 范围内，替换为 0xfffd
                    cp = 0xfffd
                } else if ((cp >= 0xfdd0 && cp <= 0xfdef) || (cp &
                    0xfffe) === 0xfffe) {
                    // 如果码点值处于 noncharacter 范围内，则什么都不做，交给平台
                    处理
                    // noop
                } else if (
                    // 控制字符集的范围是：[0x01, 0x1f] 加上 [0x7f, 0x9f]
                    // 去掉 ASICC 空白符：0x09(TAB)、0x0A(LF)、0x0C(FF)// 0x0D(CR) 虽然也是 ASICC 空白符，但需要包含
                    (cp >= 0x01 && cp <= 0x08) || cp === 0x0b || (cp >= 0x0d && cp <= 0x1f) || (cp >= 0x7f && cp <= 0x9f)
                ) {
                    // 在 CCR_REPLACEMENTS 表中查找替换码点，如果找不到，则使用原码点
                    cp = CCR_REPLACEMENTS[cp] || cp
                }
                // 解码后追加到 decodedText 上
                decodedText += String.fromCodePoint(cp)
                // 消费整个数字字符引用的内容
                advance(body[0].length)
            } else {
                // 如果没有匹配，则不进行解码操作，只是把 head[0] 追加到decodedText 上并消费
                decodedText += head[0]
                advance(head[0].length)
            }
        }
    }
    return decodedText
}
const template = '<div :id="dynamicId" @click="handler" v-on:mousedown="onMouseDown"></div>'
const ast = parse(template)
console.log(ast.children[0].props)
