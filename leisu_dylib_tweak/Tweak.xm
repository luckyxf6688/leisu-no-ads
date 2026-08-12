// ============================================================
// 雷速体育 (com.leisu.sports) v11.0.1 去广告 dylib  ——  v4 纯runtime自举版
// by 海鸥
//
// 原理: 静态解析 185MB 主二进制的 __objc_classlist, dump 出全部 11243 个类,
//       筛出 48 个雷速自有广告类。所有第三方广告 SDK(穿山甲/广点通/快手/
//       美数/章鱼/AdGain/TopOn... 2698 个类)全部经过雷速这几个"包装类"分发。
//       老子只掐包装类的加载入口, 底层 SDK 连广告请求都发不出去。
//
// 关键点 1: 不用 Substrate/ellekit —— 纯 objc runtime method_setImplementation,
//           dylib 自包含。干净系统的 TrollStore 设备也能生效。
// 关键点 2: 绝不对 init 返回 nil (那是老版本崩溃根源)。只 no-op
//           loadAdData / show / render —— 对象照活, 就是不出广告。不崩。
// 关键点 3: 这些广告类全在主二进制里, dylib 加载(%ctor)时已全部注册, 无需延迟扫描。
// ============================================================

#import <UIKit/UIKit.h>
#import <objc/runtime.h>
#import <objc/message.h>

// ────────────────────────────────
//  各返回类型的空实现 (no-op IMP)
// ────────────────────────────────
static void   noop_void(__unused id self, __unused SEL _cmd, ...) { }
static id     noop_id  (__unused id self, __unused SEL _cmd, ...) { return nil; }
static BOOL   noop_NO  (__unused id self, __unused SEL _cmd, ...) { return NO; }
static double noop_zero(__unused id self, __unused SEL _cmd, ...) { return 0.0; }

// ────────────────────────────────
//  替换实例方法 / 类方法实现 (方法不存在则安全跳过)
// ────────────────────────────────
static void patchInst(const char *clsName, const char *selName, IMP imp) {
    Class c = objc_getClass(clsName);
    if (!c) return;
    Method m = class_getInstanceMethod(c, sel_registerName(selName));
    if (!m) return;
    method_setImplementation(m, imp);
}
static void patchClass(const char *clsName, const char *selName, IMP imp) {
    Class c = objc_getClass(clsName);
    if (!c) return;
    Method m = class_getClassMethod(c, sel_registerName(selName));
    if (!m) return;
    method_setImplementation(m, imp);
}

// ────────────────────────────────
//  开屏广告特殊处理: configAndLoadAd → 跳过广告直接进主页
// ────────────────────────────────
static void splash_skip_to_home(id self, __unused SEL _cmd) {
    dispatch_async(dispatch_get_main_queue(), ^{
        @try {
            SEL go = sel_registerName("goToHomePage");
            if ([self respondsToSelector:go]) {
                ((void (*)(id, SEL))objc_msgSend)(self, go);
                return;
            }
            SEL goAnim = sel_registerName("goToHomePageAnimation");
            if ([self respondsToSelector:goAnim]) {
                ((void (*)(id, SEL))objc_msgSend)(self, goAnim);
            }
        } @catch (__unused NSException *e) { }
    });
}

// ════════════════════════════════════════════════
//  构造器 —— dylib 载入即执行全部 patch
// ════════════════════════════════════════════════
__attribute__((constructor))
static void seagull_leisu_noads_init(void) {
    @autoreleasepool {

        // ── 第一层: 开屏广告 (Splash) ──
        // configAndLoadAd 是加载开屏广告总入口, 改成直接进主页,
        // 所有开屏 SDK(GDT/CSJ/MS/UM/QM/ZY/BZ/ALI/TD/WM...)都不会被加载。
        patchInst("RMSplashViewController", "configAndLoadAd",      (IMP)splash_skip_to_home);
        patchInst("RMSplashViewController", "p_shouldUseLeisuSplashAd", (IMP)noop_NO);
        patchInst("RMSplashViewController", "requestAdTimeOut",     (IMP)noop_void);
        patchInst("RMSplashViewController", "configBiddingAd",      (IMP)noop_void);
        patchInst("RMSplashViewController", "configLeisuAdView",    (IMP)noop_void);
        patchInst("RMSplashViewController", "configADView",         (IMP)noop_void);

        patchInst("LSCodeSplashAd", "loadAdData",                   (IMP)noop_void);
        patchInst("LSCodeSplashAd", "showInWindow:withBottomView:", (IMP)noop_void);
        patchInst("LSCodeSplashAd", "notifySplashViewDidAppear",    (IMP)noop_void);

        patchInst("LSSDKSplashAd", "loadAdData:isRetry:",           (IMP)noop_void);
        patchInst("LSSDKSplashAd", "showSplashAdInView:",           (IMP)noop_void);

        patchInst("LSCodeAdSplashView", "ls_bindSplashAd:",             (IMP)noop_void);
        patchInst("LSCodeAdSplashView", "ls_renderWithAdModel:image:",  (IMP)noop_void);

        // ── 第二层: 插屏广告 (Interstitial / 评分弹屏) ──
        // RMAdProviderManager 是插屏调度中枢
        patchInst("RMAdProviderManager", "checkInterstitialAd",    (IMP)noop_void);
        patchInst("RMAdProviderManager", "checkMYInterstitialAd:", (IMP)noop_void);
        patchInst("RMAdProviderManager", "loadInterstitialAd:",    (IMP)noop_void);
        patchInst("RMAdProviderManager", "showInterstitialAd",     (IMP)noop_void);
        patchInst("RMAdProviderManager", "loadScoreScreenAd",      (IMP)noop_void);
        patchInst("RMAdProviderManager", "showLeisuScreenAd",      (IMP)noop_void);
        patchInst("RMAdProviderManager", "canShowScoreScreen",     (IMP)noop_NO);
        patchInst("RMAdProviderManager", "getLeiSuAdWithLocation:",(IMP)noop_id);

        patchInst("LSCodeAdInterstitial", "loadAdData",                 (IMP)noop_void);
        patchInst("LSCodeAdInterstitial", "showAdFromRootViewController:", (IMP)noop_void);

        patchInst("LSSDKInterstitialAd", "loadAdData:isRetry:",            (IMP)noop_void);
        patchInst("LSSDKInterstitialAd", "showAdFromRootViewController:",  (IMP)noop_void);

        // ── 第三层: 信息流 / 横幅 / 直播 / 原生广告 —— 不加载数据 ──
        patchInst("LSCodeAdFeedManager",    "loadAdData",    (IMP)noop_void);
        patchInst("LSCodeAdFeedManager",    "configOriginAd",(IMP)noop_void);
        patchInst("LSCodeAdFeedProManager", "loadAdData",    (IMP)noop_void);
        patchInst("LSCodeAdLiveManager",    "loadAdData",    (IMP)noop_void);

        // 横幅: 只掐广告, 不动 RMPublicBannerManager 的正经内容位(登录/VIP/活动)
        patchInst("LSCodeAdBannerManager",  "loadAdData",    (IMP)noop_void);
        patchInst("LSCodeAdBannerManager",  "configOriginAd",(IMP)noop_void);
        patchClass("LSCodeAdBannerManager", "canShowLeiSuAd",(IMP)noop_NO);

        patchInst("LSSDKFeedAd",   "loadAdData:", (IMP)noop_void);
        patchInst("LSSDKBannerAd", "loadAdData:", (IMP)noop_void);

        // 比赛直播贴片广告
        patchInst("MatchLivePlayerAdView", "initializeAdSDK", (IMP)noop_void);

        // ── 第四层: 视图不渲染(双保险) + 广告 Cell 高度归零 ──
        patchInst("LSCodeAdFeedView",        "render",                    (IMP)noop_void);
        patchInst("LSCodeAdFeedListView",    "render",                    (IMP)noop_void);
        patchInst("LSCodeAdFeedListView",    "configUI",                  (IMP)noop_void);
        patchInst("LSCodeAdFeedGameView",    "render",                    (IMP)noop_void);
        patchInst("LSCodeAdFeedGameView",    "configUI",                  (IMP)noop_void);
        patchInst("LSCodeAdFeedRelatedView", "render",                    (IMP)noop_void);
        patchInst("LSCodeAdFeedRelatedView", "configUI",                  (IMP)noop_void);
        patchInst("LSCodeAdFeedProView",     "render",                    (IMP)noop_void);
        patchInst("LSCodeAdFeedProView",     "configUI",                  (IMP)noop_void);
        patchInst("LSCodeAdLiveView",        "render",                    (IMP)noop_void);
        patchInst("LSCodeAdLiveView",        "configUI",                  (IMP)noop_void);
        patchInst("LSCodeAdBannerView",      "render",                    (IMP)noop_void);
        patchInst("LSCodeAdBannerView",      "configUI",                  (IMP)noop_void);
        patchInst("RMNativeFeedAdView",      "renderUnifiedNativeAdView:",(IMP)noop_void);
        patchInst("RMNativeFeedAdView",      "configUI",                  (IMP)noop_void);
        patchInst("RMNativeFeedListView",    "renderUnifiedNativeAdView:",(IMP)noop_void);

        patchClass("LSCodeAdTableViewCell",  "cellHeight", (IMP)noop_zero);
        patchClass("MatchBannerTableViewCell","cellHeight",(IMP)noop_zero);
        patchClass("MatchBannerSliderView",  "viewHeight", (IMP)noop_zero);

        NSLog(@"[海鸥去广告v4] 雷速体育 v11.0.1 —— 纯runtime精准掐咽喉版已生效 ✅");
    }
}
