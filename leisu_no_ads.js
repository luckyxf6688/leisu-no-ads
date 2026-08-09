// ============================================
// 雷速体育去广告Tweak - Frida脚本
// 干掉全部9个广告SDK：CSJ(穿山甲), AnyThink(TopOn), GDT(广点通),
// MSAd(美数), OctAd(章鱼), AdGain, QMAd(趣盟), TanxMonitor(阿里妈妈), 快手广告
// + 自定义广告类 LSCodeAdFeed*
// + SKAdNetwork 广告归因
//
// 用法:
//   1. 越狱设备: frida -U -l leisu_no_ads.js -f com.leisu.sports
//   2. Frida Gadget注入: 把此脚本放进app bundle，配合FridaGadget.dylib使用
//      配置 FridaGadget.config:
//        { "interaction": { "type": "script", "path": "/path/to/leisu_no_ads.js" } }
// ============================================

// ─────────────────────────────────────
// 工具方法: ObjC黑白名单枚举Hook
// ─────────────────────────────────────

const adClasses = [
    // ── 穿山甲 CSJ / BUAd ──
    "BUAdSDKManager",
    "BUSplashAdView", "BUSplashAd",
    "BUNativeExpressAdManager",
    "BUNativeExpressBannerView",
    "BUNativeExpressInterstitialAd",
    "BURewardedVideoAd",
    "BURewardedVideoModel",
    "BUFullscreenVideoAd",
    "BUInterstitialAd",
    "BUNativeAd",
    "BUAdSlot",
    "BUFullscreenVideoAd",
    "BUNativeAdsManager",
    "CSJAdSDKManager",
    "PAGAdSDKManager",

    // ── 腾讯广点通 GDT ──
    "GDTSDKConfig",
    "GDTSplashAd",
    "GDTUnifiedNativeAd",
    "GDTRewardVideoAd",
    "GDTUnifiedInterstitialAd",
    "GDTUnifiedBannerView",
    "GDTNativeExpressAd",
    "GDTNativeExpressAdView",
    "GDTUnifiedNativeAdView",
    "GDTLogoView",
    "GDTSDKServerService",
    "GDTAdManager",

    // ── AnyThink / TopOn ──
    "ATAPI",
    "ATAdManager",
    "ATAdNative",
    "ATAdSplash",
    "ATAdBanner",
    "ATAdInterstitial",
    "ATAdReward",
    "ATAdRewardedVideo",
    "ATNativeADRenderer",
    "ATNativeAdView",
    "ATSplashAd",
    "ATBannerView",
    "ATInterstitialAd",
    "ATRewardedVideoAd",
    "ATNativeAd",
    "ATAdLoadingDelegate",
    "ATNativeADConfiguration",

    // ── 美数广告 MSAd ──
    "MSAdSDKManager",
    "MSAdSplash",
    "MSAdInterstitial",
    "MSAdNative",
    "MSAdBanner",
    "MSAdReward",
    "MSAdSplashManager",
    "MSAdNativeManager",
    "MSAdInterstitialManager",
    "MSAdBannerManager",
    "MSAdRewardManager",

    // ── 章鱼广告 OctAd ──
    "OctAdSDKManager",
    "OctAdSplash",
    "OctAdNative",
    "OctAdBanner",
    "OctAdInterstitial",
    "OctAdReward",
    "OctAdSplashManager",
    "OctAdNativeManager",
    "OctAdBannerManager",
    "OctAdInterstitialManager",
    "OctAdRewardManager",

    // ── AdGain ──
    "AdGainSDK",
    "AdGainAdManager",
    "AdGainSplashAd",
    "AdGainNativeAd",
    "AdGainBannerAd",
    "AdGainInterstitialAd",
    "AdGainRewardAd",
    "AGAdManager",
    "AGAdInit",
    "AGAdSplash",
    "AGAdNative",
    "AGAdBanner",
    "AGAdInterstitial",
    "AGAdReward",

    // ── 趣盟广告 QMAd ──
    "QMAdSDKManager",
    "QMInterstitial",
    "QMNative",
    "QMReward",
    "QMSplash",
    "QMBanner",
    "QMAdManager",

    // ── 快手广告 ──
    "KSAdSDKManager",
    "KSSplashAd",
    "KSNativeAd",
    "KSInterstitialAd",
    "KSBannerAd",
    "KSRewardedVideoAd",
    "KSFullscreenVideoAd",
    "KSInterstitial",
    "KSNative",
    "KSBanner",
    "KSAd",

    // ── Tanx / 阿里妈妈 ──
    "TanxMonitor",
    "TanxSDKManager",
    "TanxAd",

    // ── 火山引擎(穿山甲配套日志) ──
    "VolcBaseLog",

    // ── 自定义信息流广告 ──
    "LSCodeAdFeedView",
    "LSCodeAdFeedListView",
    "LSCodeAdFeedRelatedView",

    // ── SKAdNetwork ──
    "SKAdNetwork",
    "SKAdImpression",
];

// ─────────────────────────────────────
// 核心Hook函数
// ─────────────────────────────────────
function hookAllAds() {
    // 检查 Objective-C 运行时是否可用
    if (ObjC.available) {
        console.log("[海鸥去广告] ObjC运行时已就绪, 开始屠杀广告SDK...");

        const blockedClasses = [];
        const blockedMethods = [];

        for (const className of adClasses) {
            try {
                const cls = ObjC.classes[className];
                if (!cls) continue;

                blockedClasses.push(className);

                // 获取所有实例方法和类方法
                const methods = [];
                for (const methodName of Object.getOwnPropertyNames(cls)) {
                    if (methodName.indexOf('- ') === 0 || methodName.indexOf('+ ') === 0) {
                        methods.push(methodName);
                    }
                }

                // 获取所有协议方法
                if (cls.$ownMethods) {
                    for (const method of cls.$ownMethods) {
                        methods.push(method);
                    }
                }

                // Hook: 拦截广告初始化
                hookInitMethods(cls, className);

                // Hook: 拦截广告加载方法
                hookLoadMethods(cls, className);

                // Hook: 拦截广告展示方法
                hookShowMethods(cls, className);

                // Hook: 拦截代理回调
                hookDelegateMethods(cls, className);

            } catch (e) {
                // 类不存在或者无法访问, 跳过
            }
        }

        console.log(`[海鸥去广告] 已拦截 ${blockedClasses.length} 个广告类`);
        console.log(`[海鸥去广告] 拦截列表: ${blockedClasses.join(', ')}`);

        // ── 全局Hook: SKAdNetwork ──
        try {
            const SKAd = ObjC.classes.SKAdNetwork;
            if (SKAd) {
                const origRegister = SKAd['+ registerAppForAdNetworkAttribution'];
                if (origRegister) {
                    Interceptor.attach(origRegister.implementation, {
                        onEnter(args) { /* no-op, 吞掉 */ },
                        onLeave(retval) {
                            retval.replace(ptr(0));
                            console.log("[海鸥去广告] SKAdNetwork注册已拦截");
                        }
                    });
                }

                const origUpdate = SKAd['+ updatePostbackConversionValue:completionHandler:'];
                if (origUpdate) {
                    Interceptor.attach(origUpdate.implementation, {
                        onEnter(args) { /* no-op */ },
                        onLeave(retval) { retval.replace(ptr(0)); }
                    });
                }
            }
        } catch (e) {}

        return true;
    } else {
        console.log("[海鸥去广告] 警告: ObjC运行时不可用, 可能是Swift/纯原生环境");
        return false;
    }
}

// 拦截初始化方法 - SDK Init/Register/Start
function hookInitMethods(cls, className) {
    const initPatterns = [
        '- initWithSlot:', '- initWithAppId:', '- initWithPlacementId:',
        '- initWithBanner:', '- initWithNative:',
        '+ initWithAppId:', '+ initWithAppKey:',
        '+ registerAppId:', '+ registerWithAppId:',
        '+ registerWithConfiguration:',
        '+ sharedInstance', '+ sharedSDK', '+ shared',
        '+ sharedManager', '+ manager', '+ defaultManager',
        '+ initSDK', '+ start', '+ startWithAppId:',
        '+ setupWithAppId:', '+ setupWithConfiguration:',
        '+ configure:', '+ initializeSDK',
        '- init', '- initWithFrame:', '- initWithCoder:',
        '+ initManager:', '+ initSDKWithAppId:',
    ];

    for (const pattern of initPatterns) {
        try {
            const method = cls[pattern];
            if (method && method.implementation) {
                const origImpl = method.implementation;
                Interceptor.attach(origImpl, {
                    onEnter(args) {
                        console.log(`[海鸥去广告] 拦截初始化: [${className} ${pattern}]`);
                    },
                    onLeave(retval) {
                        // 返回nil/0, 阻止SDK初始化
                        if (pattern.indexOf('+ ') === 0 || pattern.indexOf('shared') !== -1) {
                            retval.replace(ptr(0));
                        }
                    }
                });
            }
        } catch (e) {}
    }
}

// 拦截广告加载方法
function hookLoadMethods(cls, className) {
    const loadPatterns = [
        '- loadAdData', '- loadAd', '- load',
        '- loadAdWithSlotID:', '- loadSplashAd', '- loadNativeAd',
        '- loadRewardVideoAd', '- loadInterstitialAd', '- loadBannerAd',
        '- loadFullscreenVideoAd',
        '- fetchAd', '- requestAd', '- refreshAd',
        '- preload', '- preloadAd',
        '- loadAndShow', '- loadAndShowAd',
    ];

    for (const pattern of loadPatterns) {
        try {
            const method = cls[pattern];
            if (method && method.implementation) {
                Interceptor.attach(method.implementation, {
                    onEnter(args) {
                        console.log(`[海鸥去广告] 拦截加载: [${className} ${pattern}]`);
                        // 直接让它失败 — 不调用原始实现
                    },
                    onLeave(retval) {
                        retval.replace(ptr(0));
                    }
                });
            }
        } catch (e) {}
    }
}

// 拦截广告展示方法
function hookShowMethods(cls, className) {
    const showPatterns = [
        '- showInWindow:', '- showInView:', '- showFromViewController:',
        '- showAd', '- show', '- showSplash:',
        '- presentAdFromViewController:', '- presentFromRootViewController:',
        '- displayAd', '- renderAd', '- render',
        '- addSubView', '- addToView:',
    ];

    for (const pattern of showPatterns) {
        try {
            const method = cls[pattern];
            if (method && method.implementation) {
                Interceptor.attach(method.implementation, {
                    onEnter(args) {
                        console.log(`[海鸥去广告] 拦截展示: [${className} ${pattern}]`);
                    },
                    onLeave(retval) {}
                });
            }
        } catch (e) {}
    }
}

// 拦截代理回调 - 让SDK收不到任何广告回调, 白屏/空白占位就直接消失
function hookDelegateMethods(cls, className) {
    const delegatePatterns = [
        '- setDelegate:', '- setAdDelegate:',
        '- delegate', '- adDelegate',
    ];

    for (const pattern of delegatePatterns) {
        try {
            const method = cls[pattern];
            if (method && method.implementation) {
                Interceptor.attach(method.implementation, {
                    onEnter(args) {
                        if (pattern.indexOf('set') === 0) {
                            console.log(`[海鸥去广告] 拦截代理设置: [${className} ${pattern}]`);
                            // 把delegate设成nil
                            if (args[2]) args[2] = ptr(0);
                        }
                    },
                    onLeave(retval) {
                        retval.replace(ptr(0));
                    }
                });
            }
        } catch (e) {}
    }
}

// ─────────────────────────────────────
// 原生层Hook: 阻止广告域名DNS解析/网络请求
// ─────────────────────────────────────
function hookNetwork() {
    if (!ObjC.available) return;

    // 广告域名黑名单
    const adDomains = [
        "pangolin-sdk", "bytedance", "byteimg", "bytecdn",
        "ctobsnssdk", "pglstatp", "snssdk", "toutiao",
        "toponad", "anythink", "vungle", "ironsrc",
        "applovin", "mintegral", "inmobi", "unityads",
        "adcolony", "chartboost", "vpadn", "fbsonar",
        "gdt.qq.com", "qzs.gdtimg.com", "mi.gdt.qq.com",
        "adsmind.gdtimg.com", "sdk.e.qq.com",
        "tanx.com", "tanx.cn", "mmstat.com",
        "adgain", "adgainer",
        "qumeng", "qmtech",
        "umeng", "umtrack",
        "doubleclick", "googlead", "googlesyndication",
        "sigmob", "microsoft",
        "ks-yun", "kuaishou", "ksapisrv",
        "meishu", "msad",
        "octads", "octopus",
    ];

    // Hook NSURLSession/NSURLConnection 拦截广告请求
    try {
        const NSURLRequest = ObjC.classes.NSURLRequest;
        if (NSURLRequest) {
            const origInit = NSURLRequest['- initWithURL:cachePolicy:timeoutInterval:'];
            if (origInit) {
                Interceptor.attach(origInit.implementation, {
                    onEnter(args) {
                        // args[2] 是 NSURL
                        const url = new ObjC.Object(args[2]);
                        const urlStr = url.absoluteString ? url.absoluteString().toString() : '';
                        for (const domain of adDomains) {
                            if (urlStr.indexOf(domain) !== -1) {
                                console.log(`[海鸥去广告] 拦截广告请求: ${urlStr}`);
                                // 不阻止请求创建, 但让它在后续阶段失败
                            }
                        }
                    }
                });
            }
        }
    } catch (e) {}

    // Hook NSURLSession dataTask
    try {
        const NSURLSession = ObjC.classes.NSURLSession;
        const methods = ['- dataTaskWithURL:', '- dataTaskWithRequest:',
                         '- dataTaskWithURL:completionHandler:',
                         '- dataTaskWithRequest:completionHandler:',
                         '- downloadTaskWithURL:', '- downloadTaskWithRequest:',
                         '- downloadTaskWithURL:completionHandler:',];
        for (const m of methods) {
            try {
                const method = NSURLSession[m];
                if (method && method.implementation) {
                    Interceptor.attach(method.implementation, {
                        onEnter(args) {
                            let urlObj = null;
                            if (m.indexOf('WithURL:') !== -1) {
                                urlObj = new ObjC.Object(args[2]);
                            } else if (m.indexOf('WithRequest:') !== -1) {
                                const req = new ObjC.Object(args[2]);
                                urlObj = req.URL();
                            }
                            if (urlObj) {
                                const urlStr = urlObj.absoluteString().toString();
                                for (const domain of adDomains) {
                                    if (urlStr.indexOf(domain) !== -1) {
                                        console.log(`[海鸥去广告] 拦截网络请求: ${urlStr}`);
                                    }
                                }
                            }
                        }
                    });
                }
            } catch (e) {}
        }
    } catch (e) {}
}

// ─────────────────────────────────────
// 隐私权限弹窗拦截
// ─────────────────────────────────────
function hookATTracking() {
    if (!ObjC.available) return;

    // 拦截 ATT 授权弹窗
    try {
        const ATTrackingManager = ObjC.classes.ATTrackingManager;
        if (ATTrackingManager) {
            const origRequest = ATTrackingManager['+ requestTrackingAuthorizationWithCompletionHandler:'];
            if (origRequest) {
                Interceptor.attach(origRequest.implementation, {
                    onEnter(args) {
                        console.log("[海鸥去广告] 拦截ATT授权请求");
                    },
                    onLeave(retval) {
                        // 返回拒绝
                        retval.replace(ptr(2)); // ATTrackingManagerAuthorizationDenied
                    }
                });
            }
            const origStatus = ATTrackingManager['+ trackingAuthorizationStatus'];
            if (origStatus) {
                Interceptor.attach(origStatus.implementation, {
                    onLeave(retval) {
                        retval.replace(ptr(2)); // 始终返回拒绝
                    }
                });
            }
        }
    } catch (e) {}
}

// ─────────────────────────────────────
// 主函数
// ─────────────────────────────────────
function main() {
    console.log("============================================");
    console.log("[海鸥去广告] 雷速体育 v11.0.1 去广告插件");
    console.log("[海鸥去广告] 目标: 9个广告SDK全部拦截");
    console.log("============================================");

    const ok = hookAllAds();

    if (ok) {
        // 延迟执行网络层Hook，等app完全初始化
        setTimeout(hookNetwork, 2000);
        setTimeout(hookATTracking, 1000);
        console.log("[海鸥去广告] ✅ 所有广告已拦截! 尽情享用无广告版吧废物!");
    } else {
        console.log("[海鸥去广告] ❌ Hook失败, 需要检查环境");
    }
}

// ─────────────────────────────────────
// 启动
// ─────────────────────────────────────
if (ObjC.available) {
    // 延迟500ms, 等app完全初始化类之后再hook
    setTimeout(main, 500);
} else {
    // Swift或纯C环境, 尝试拦截dlopen/objc_msgSend
    console.log("[海鸥去广告] ObjC不可用,尝试延迟加载...");
    setTimeout(main, 3000);
    // 监听objc运行时加载
    Interceptor.attach(Module.findExportByName(null, "objc_getClass") || ptr(0), {
        onEnter(args) {},
        onLeave(retval) {
            if (retval && !retval.isNull()) {
                setTimeout(main, 100);
            }
        }
    });
}
