function defineAsyncComponent(options) {
    // 可以直接传入异步加载函数，也可传入配置项
    if (typeof options === 'function') {
        options = {
            loader: options
        }
    }
    // 从配置项中获取加载器
    const { loader } = options
    // 定义加载重试函数
    let retires = 0
    function load() {
        return loader()
            .catch(err => {
                if (options.onError) {
                    return new Promise((resolve, reject) => {
                        const retry = () => {
                            resolve(load())
                            retires++
                        }
                        const fail = () => reject(err)
                        options.onError(retry, fail)
                    })
                } else {
                    throw err
                }
            })
    }
    // 定义存储异步组件的变量
    let InnerComp = null
    // defineAsyncComponent本质是高阶组件，返回值是一个组件的vnode
    return {
        type: 'asyncComponentWrapper',
        setup () {
            // 定义一个异步组件加载完成的标识
            const loaded = ref(false)
            // 定义一个异步组件加载超时标志
            const error = shallowRef(null)
            // 定义一个异步组件处于加载中状态的标识
            const loading = ref(false)
            let loadingTimer = null
            if (options.delay) {
                loadingTimer = setTimeout(() => {
                    loading.value = true
                }, options.delay)
            }
            load()
                .then(c => {
                    InnerComp = c
                    loaded.value = true
                })
                .catch(err => {
                    error.value = err
                })
                .finally(() => {
                    // 异步组件无论加载成功与否，加载完成都需要清除定时器
                    loading.value = false
                    clearTimeout(loadingTimer)
                })
            // 组件开始加载时启动定时
            let timer = null
            if (options.timeout) {
                timer = setTimeout(() => {
                    const err = new Error(`Async component time out after ${options.timeout}ms`)
                    error.value = err
                }, options.timeout)
            }
            // 异步组件卸载时需要清除定时器
            onUnmounted(() => clearTimeout(timer))

            const placeholder = { type: Text, children: '' }
            return () => {
                // 根据不同标识变量的值决定渲染函数返回的值
                if (loaded.value) {
                    return { type: InnerComp }
                } else if (error.value && options.errorComponent) {
                    return { type: options.errorComponent, props: { error: error.value } }
                } else if (loading.value && options.loadingComponent) {
                    return { type: options.loadingComponent }
                } else {
                    return placeholder
                }
            }
        }
    }
}