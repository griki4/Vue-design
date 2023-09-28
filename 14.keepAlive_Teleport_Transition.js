// keepAlive的原理是使用其实例上的方法代替组件的挂载和卸载操作，使用组件vnode在容器间移动的方式来代替挂载和卸载从而实现缓存
const KeepAlive = {
    // keepAlive组件独有的标识
    _isKeepAlive: true,
    setup(props,  { slots }) {
        // 创建一个缓存对象。key: vnode.type, value: vnode
        const cache = new Map()
        // 获取keepAlive组件的实例
        const instance = currentInstance
        // 组件实例上的keepAlivectx包含一些渲染器相关的方法
        const { move, createElement } = instance.keepAlivectx
        // 创建用于缓存组件的隐藏容器
        const storageContainer = createElement('div')
        // 组件实例上定义两个方法，用于在页面和隐藏容器之间移动组件
        instance._deactivate = (vnode) => {
            move(vnode, storageContainer)
        }
        instance._activate = (vnode, container, anchor) => {
            move(vnode, container, anchor)
        }
        return () => {
            // 默认插槽中就是需要缓存的组件
            let rawVnode = slots.default()
            // 不是组件则直接渲染，因为非组件不能被缓存
            if (typeof rawVnode.type !== 'object') {
                return rawVnode
            }
            const name = rawVnode.type.name
            if (
                name && (
                    (props.include && !props.include.test(name)) ||
                    (props.exclude && props.exclude.test(name))
                )
            ) {
                // 没命中include或者命中exclude的时候，不缓存组件直接渲染
                return rawVnode
            }
            // 挂载组件之前获取缓存组件的vnode
            const cacheVnode = cache.get(rawVnode.type)
            if (cacheVnode) {
                // 有缓存，则直接从缓存中获取组件vnode
                rawVnode.component = cacheVnode.component
                // 添加标识，避免渲染器直接将缓存组件进行挂载
                rawVnode.keepAlive = true
            } else {
                cache.set(rawVnode.type, rawVnode)
            }
            // 添加一个标识，避免渲染器将组件卸载。进行卸载unmount操作时，如果组件vnode有shouleKeepAlive属性，则会调用_deactivate方法。
            rawVnode.shouleKeepAlive = true
            // 将keepAlive实例添加到缓存组件vnode上以便在渲染器中访问
            rawVnode.keepAliveInstance = instance
            return rawVnode
        }
    }
}

// Teleport通过to配置利用CSS选择器的方式找到目标容器，将其内部的组件或者元素渲染到目标容器下
const Teleport = {
    // 挂载组件时标识为Teleport组件，外部调用Teleport组件的process方法
    _isTeleport: true,
    process(n1, n2, container, anchor, internals) {
        // Teleport组件内部的内容会被编译为一个数组
        const { patch, patchChildren, move } = internals
        if (!n1) {
            // 直接挂载。根据to配置获取需要挂载的元素点。
            const target = typeof n2.props.to === 'string'
                ? document.querySelector(n2.props.to)
                : n2.props.to
            // 遍历Teleport内部的元素并逐一挂载
            n2.children.forEach(c => patch(null, c, target, anchor))
        } else {
            patchChildren(n1, n2, container)
            // 如果是因为to属性变化引起的更新，则直接移动元素即可
            if (n1.props.to !== n1.props.to) {
                const newTarget = typeof n2.props.to === 'string'
                    ? document.querySelector(n2.props.to)
                    : n2.props.to
                n2.children.forEach(c => move(c, newTarget))
            }
        }
    }
}


const Transition = {
    name: 'Transition',
    setup(props, { slots }) {
        return () => {
            // 获取内部需要进行过渡的元素
            const innerVnode = slots.default()
            // 为内部组件的Vnode添加transition对象，内部包含一系列钩子函数。这行钩子函数会在渲染的合适时机被渲染器调用以达到过渡效果。
            innerVnode.transition = {
                beforeEnter(el) {
                    // 设置元素初始状态和过渡动画
                    el.classList.add('enter-from')
                    el.classList.add('enter-active')
                },
                enter(el) {
                    nextFrame(() => {
                        // 添加最终状态，移除初始状态触发过渡效果
                        el.classList.remove('enter-from')
                        el.classList.add('enter-to')
                        // 过渡完成后，移除所有的过渡相关样式
                        el.addEventListener('transitioned', () => {
                            el.classList.remove('enter-to')
                            el.classList.remove('enter-active')
                        })
                    })

                },
                leave(el, performRemove) {
                    // 添加初始状态和过渡动画
                    el.classList.add('leave-from')
                    el.classList.add('leave-active')
                    // 强制重绘，确保初始状态生效
                    document.body.offsetHeight
                    // 下一帧执行离开动画
                    nextFrame(() => {
                        el.classList.remove('leave-from')
                        el.classList.add('leave-to')

                        el.addEventListener('transitioned', () => {
                            el.classList.remove('leave-to')
                            el.classList.remove('leave-active')
                            performRemove()
                        })
                    })
                }
            }
            return innerVnode
        }
    }
}