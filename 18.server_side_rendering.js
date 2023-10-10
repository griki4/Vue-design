const ElementVNode = {
    type: 'div',
    props: {
        id: 'foo'
    },
    children: [
        {type: 'p', children: 'hello'}
    ]
}
// 自闭合标签的种类
const VOID_TAGS = 'area,base,br,col,embed,hr,img,input,link,meta,param,source,track,wbr'.split(',')
// 服务端将虚拟DOM渲染为HTML字符串的函数
function renderElementVNode(vnode) {
    const { type: tag, props, children } = vnode
    const isVoidElement = VOID_TAGS.includes(tag)
    let ret = `<${tag}`
    if (props) {
        for (const k in props) {
            ret += ` ${k}="${props[k]}"`
        }
    }
    ret += isVoidElement ? `/>` : `>`
    if (isVoidElement) return ret
    if (typeof children === 'string') {
        ret += children
    } else if (Array.isArray(children)) {
        children.forEach(child => {
            ret += renderElementVNode(child)
        })
    }
    ret += `</${tag}>`
    return ret
}
// 仅与组件运行相关的属性应该被忽略
const shouldIgnoreProp = ['key', 'ref']
function renderAttrs(props) {
    let ret = ''
    for (const key in props) {
        if (shouldIgnoreProp.includes(key) || /^on[^a-z]/.test(key)) {
            continue
        }
        const value = props[key]
        ret += renderDynamicAttr(key, value)
    }
    return ret
}
// 判断属性是否为boolean attribute
const isBooleanAttr = (key) => {
    return (`itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly` + `,async,autofocus,autoplay,controls,default,defer,disabled,hidden,`
        + `loop,open,required,reversed,scoped,seamless,` + `checked,muted,multiple,selected`).split(',').includes(key)
}
// 判断属性名称是否安全合法
const isSSRSafeAttrName = (key) =>
    !/[>/="'\u0009\u000a\u000c\u0020]/.test(key)
function renderDynamicAttr(key, value) {
    if (isBooleanAttr(key)) {
        return value === false ? `` : ` ${key}`
    } else if (isSSRSafeAttrName(key)) {
        return value === '' ? ` ${key}` : `${key}="${escapeHTML(value)}"`
    } else {
        console.warn(`[@vue/server-renderer] Skipped rendering unsafe attribute name: ${key}`)
    }
    return ''
}
const escapeRE = /["'&<>]/
function escapeHtml(string) {
    const str = '' + string
    const match = escapeRE.exec(str)
    if (!match) {
        return str
    }
    let html = ''
    let escaped
    let index
    let lastIndex = 0
    for (index = match.index; index < str.length; index++) {
        switch (str.charCodeAt(index)) {
            case 34: // "
                escaped = '&quot;'
                break
            case 38: // &
                escaped = '&amp;'
                break
            case 39: // '
                escaped = '&#39;'
                break
            case 60: // <
                escaped = '&lt;'
                break
            case 62: // >
                escaped = '&gt;'
                break
            default:
                continue
        }
        if (lastIndex !== index) {
            html += str.substring(lastIndex, index)
            }
        lastIndex = index + 1
        html += escaped
        }
    return lastIndex !== index ? html + str.substring(lastIndex, index) : html
}
// 服务端渲染组件：执行组件的render函数获取虚拟DOM，根据虚拟DOM生成HTML字符串
// 区别：服务端渲染组件，组件的data和props数据无需响应式。服务端渲染组件无需创建真实DOM元素。
console.log(renderElementVNode(ElementVNode))



const MyComponent = {
    name: 'App',
    setup() {
        const str = ref('foo')

        return () => {
            return {
                type: 'div',
                children: [
                    {
                        type: 'span',
                        children: str.value,
                        props: {
                            onClick: () => {
                                str.value = 'bar'
                            }
                        }
                    },
                    {type: 'span', children: 'baz'}
                ]
            }
        }
    }
}
const CompVNode = {
    type: MyComponent
}
// 同构渲染的伪代码
// 由服务端渲染的静态HTML字符串
const html = renderCompVNode(CompVNode)
// 将html字符串挂载到容器
const container = document.querySelector('#app')
container.innerHTML = html
// 执行激活代码
renderer.hydrate(CompVNode, container)

function createRenderer(options) {
    function hydrate(node, vnode) {
        hydrateNode(container.firstChild, vnode)
    }
    function render() {

    }
    return {
        hydrate,
        render
    }
}
function hydrateNode(node, vnode) {
    const { type } = vnode
    vnode.el = node

    if (typeof type === 'object') {
        // 组件类型的元素直接使用mountComponent进行激活
        // 在执行组件挂载前，检查vnode.el是否已经存在。存在则调用hyrateNode进行激活，否则正常挂载。
        mountComponent(vnode, container, null)
    } else if (typeof type === 'string'){
        if (node.nodeType !== 1) {
            console.error('mismatch')
            console.error('服务端渲染的真实 DOM 节点是：', node)
            console.error('客户端渲染的虚拟 DOM 节点是：', vnode)
        } else {
            hydrateElement(node, vnode)
        }
    }
    // 用于进行下一个节点的激活
    return node.nextSibling
}

function hydrateElement(el, vnode) {
    // 首先进行事件绑定
    if (vnode.props) {
        for (const key in vnode.props) {
            if (/^on/.test(key)) {
                patchProps(el, key, null, vnode.props[key])
            }
        }
    }
    // 递归激活子节点
    if (Array.isArray(vnode.children)) {
        let nextNode = vnode.children[0]
        for (let i = 0; i < vnode.children.length; i++) {
            // hydrateNode的返回值是下一个真实DOM节点，当前节点激活完毕后。nextNode指向下一个真实DOM节点
            nextNode = hydrateNode(nextNode, vnode.children[i])
        }
    }
}