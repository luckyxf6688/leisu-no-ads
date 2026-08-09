// ============================================
// 雷速体育去广告 dylib v2 - 通用Hook版
// 不依赖具体类名，用runtime动态拦截
// 策略: Hook所有UIView/UIViewController的广告相关初始化
// 加上针对所有已知广告SDK的method swizzling
// ============================================

#import <UIKit/UIKit.h>
#import <objc/runtime.h>
#import <objc/message.h>

// ═══════════════════════════════
// 工具: 动态替换方法实现为空操作
// ═══════════════════════════════

static void replace_with_nil_return(id self, SEL _cmd) {
    // 不做任何事，返回nil (ObjC消息发送给nil返回nil)
}

static id replace_with_nil(id self, SEL _cmd, ...) {
    return nil;
}

static BOOL replace_with_NO(id self, SEL _cmd, ...) {
    return NO;
}

static void replace_with_nop(id self, SEL _cmd, ...) {
    // no-op
}

// ═══════════════════════════════
// 核心: 扫描并hook所有广告类
// ═══════════════════════════════

// 已知广告SDK前缀 — 匹配这些前缀的所有类的关键方法会被hook
static NSArray<NSString *> *adClassPrefixes = nil;
// 已知广告方法关键词
static NSArray<NSString *> *adMethodKeywords = nil;

static BOOL isAdClass(Class cls) {
    if (!cls) return NO;
    const char *name = class_getName(cls);
    if (!name) return NO;

    NSString *className = [NSString stringWithUTF8String:name];

    // 精确匹配广告SDK前缀
    NSArray *prefixes = @[
        // 穿山甲 CSJ/BU
        @"BU", @"CSJ", @"PAG",
        // 腾讯广点通
        @"GDT",
        // AnyThink/TopOn - AT前缀(注意: ATAuthSDK不是广告)
        @"ATAd", @"ATNative", @"ATSplash", @"ATBanner", @"ATInterstitial",
        @"ATRewarded", @"ATOffer", @"ATADX", @"ATMy", @"ATDirect",
        @"ATOnline", @"ATSelf", @"ATTD",
        // OctAd 章鱼
        @"OctAd",
        // AdGain
        @"AdGain",
        // QMAd 趣盟
        @"QMAd", @"QMInter", @"QMNative", @"QMBanner", @"QMReward", @"QMSplash",
        // 快手
        @"KSAd", @"KSSplash", @"KSInter", @"KSNative", @"KSBanner",
        @"KSReward", @"KSFull",
        // 美数
        @"MSAd",
        // Tanx
        @"Tanx",
        // 阿里
        @"ALISplash", @"ALIReward",
        // VolcBase(火山引擎，广告数据上报)
        @"VolcBase",
        // AdColony
        @"AdColony",
        // Vungle
        @"Vungle",
        // UnityAds
        @"UnityAds", @"UADS",
        // AppLovin
        @"ALAd", @"MAAd", @"ALSdk",
        // ironSource
        @"IronSource", @"ISAd", @"ISDemand",
        // Mintegral
        @"MTG",
        // InMobi
        @"IMAd", @"IMInterstitial",
        // Sigmob
        @"Sigmob", @"WindAd",
        // Chartboost
        @"Chartboost", @"CHB",
        // FBAudience / Meta
        @"FBAd", @"FBNative",
        // Admob/Google
        @"GAD", @"GGL",
        // 雷速自定义
        @"LSCodeAd",
        // 其他常见
        @"ABU", // AnyThink内部
        @"ADN", @"ADX", @"AMP", @"MPS",
    ];

    for (NSString *prefix in prefixes) {
        if ([className hasPrefix:prefix]) {
            // 排除误杀的非广告类
            if ([className hasPrefix:@"ATAuthSDK"]) return NO;
            if ([className hasPrefix:@"AT"]) {
                // AT开头的需要更精确匹配
                if ([className rangeOfString:@"Splash"].location != NSNotFound) return YES;
                if ([className rangeOfString:@"Ad"].location != NSNotFound) return YES;
                if ([className rangeOfString:@"Native"].location != NSNotFound) return YES;
                if ([className rangeOfString:@"Banner"].location != NSNotFound) return YES;
                if ([className rangeOfString:@"Reward"].location != NSNotFound) return YES;
                if ([className rangeOfString:@"Interstitial"].location != NSNotFound) return YES;
                if ([className rangeOfString:@"Offer"].location != NSNotFound) return YES;
                return NO;
            }
            return YES;
        }
    }
    return NO;
}

static BOOL isAdMethod(SEL selector) {
    NSString *selName = NSStringFromSelector(selector);

    NSArray *keywords = @[
        @"loadAd", @"showAd", @"renderAd", @"displayAd", @"fetchAd",
        @"requestAd", @"preload", @"loadAndShow", @"initWithSlot",
        @"initWithPlacement", @"initWithAppId", @"initWithAppKey",
        @"registerAppId", @"registerWithAppId", @"startWithAppId",
        @"setupWithAppId", @"initSDK", @"startSDK", @"configure",
        @"showInWindow", @"showFrom", @"presentFrom", @"presentAd",
        @"showInterstitial", @"showReward", @"showSplash", @"showBanner",
        @"loadNativeAd", @"loadSplashAd", @"loadBannerAd",
        @"loadInterstitialAd", @"loadRewardVideoAd",
        @"loadFullscreenVideoAd", @"initWithSlotID", @"initWithAdSize",
        @"setDelegate", @"setAdDelegate",
    ];

    for (NSString *kw in keywords) {
        if ([selName rangeOfString:kw].location != NSNotFound) {
            return YES;
        }
    }
    return NO;
}

// ═══════════════════════════════
// Hook单个类的广告方法
// ═══════════════════════════════

static void hookAdClass(Class cls) {
    if (!cls) return;

    unsigned int methodCount = 0;
    Method *methods = class_copyMethodList(cls, &methodCount);

    for (unsigned int i = 0; i < methodCount; i++) {
        SEL sel = method_getName(methods[i]);
        if (!isAdMethod(sel)) continue;

        // 只hook实例方法 (类方法走 object_getClass(cls))
        const char *returnType = method_copyReturnType(methods[i]);
        char firstChar = returnType ? returnType[0] : 'v';
        free((void *)returnType);

        // 根据返回类型选择替换实现
        IMP newImp = NULL;
        if (firstChar == '@' || firstChar == '#') {
            // 返回对象 — 返回nil
            newImp = (IMP)replace_with_nil;
        } else if (firstChar == 'B' || firstChar == 'c') {
            // 返回BOOL — 返回NO
            newImp = (IMP)replace_with_NO;
        } else {
            // void或其他 — no-op
            newImp = (IMP)replace_with_nop;
        }

        // 不替换method，而是用method_setImplementation (危险但有效)
        method_setImplementation(methods[i], newImp);
    }
    free(methods);

    // Hook类方法 (元类)
    Class metaCls = object_getClass(cls);
    Method *metaMethods = class_copyMethodList(metaCls, &methodCount);
    for (unsigned int i = 0; i < methodCount; i++) {
        SEL sel = method_getName(metaMethods[i]);
        if (!isAdMethod(sel)) continue;

        const char *returnType = method_copyReturnType(metaMethods[i]);
        char firstChar = returnType ? returnType[0] : 'v';
        free((void *)returnType);

        IMP newImp = NULL;
        if (firstChar == '@' || firstChar == '#') {
            newImp = (IMP)replace_with_nil;
        } else if (firstChar == 'B' || firstChar == 'c') {
            newImp = (IMP)replace_with_NO;
        } else {
            newImp = (IMP)replace_with_nop;
        }

        method_setImplementation(metaMethods[i], newImp);
    }
    free(metaMethods);
}

// ═══════════════════════════════
// 扫描所有已注册类，hook广告类
// ═══════════════════════════════

static void scanAndHookAllClasses(void) {
    unsigned int classCount = 0;
    Class *allClasses = objc_copyClassList(&classCount);

    int hookedCount = 0;
    for (unsigned int i = 0; i < classCount; i++) {
        Class cls = allClasses[i];
        if (isAdClass(cls)) {
            hookAdClass(cls);
            hookedCount++;
        }
    }
    free(allClasses);
    NSLog(@"[海鸥去广告] 扫描 %u 个类, hook了 %d 个广告类", classCount, hookedCount);
}

// ═══════════════════════════════
// 延迟扫描 — framework可能在dyld加载后才注册
// ═══════════════════════════════

static void delayedScan(void) {
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.5 * NSEC_PER_SEC)),
                   dispatch_get_main_queue(), ^{
        scanAndHookAllClasses();
    });
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(1.5 * NSEC_PER_SEC)),
                   dispatch_get_main_queue(), ^{
        scanAndHookAllClasses();
    });
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(3.0 * NSEC_PER_SEC)),
                   dispatch_get_main_queue(), ^{
        scanAndHookAllClasses();
    });
}

// ═══════════════════════════════
// 显式hook已知的雷速开屏广告相关类
// 这些类名从二进制里搜出来的，确保不漏
// ═══════════════════════════════

// TopOn开屏广告 (ATSplash* 系列)
%hook ATSplashManager
- (void)loadSplashAd { }
- (void)showSplashAd { }
+ (instancetype)sharedInstance { return nil; }
%end

%hook ATSplash
- (void)loadAd { }
- (void)showInWindow:(UIWindow *)window { }
- (instancetype)initWithPlacementID:(NSString *)pid { return nil; }
- (instancetype)initWithPlacementID:(NSString *)pid extra:(NSDictionary *)extra { return nil; }
- (instancetype)initWithPlacementID:(NSString *)pid extra:(NSDictionary *)extra delegate:(id)delegate { return nil; }
%end

// 穿山甲开屏
%hook BUSplashAdView
- (instancetype)initWithSlotID:(NSString *)slot adSize:(CGSize)size rootViewController:(UIViewController *)vc { return nil; }
- (void)loadAdData { }
- (void)showSplashViewInWindow:(UIWindow *)w { }
%end

%hook BUSplashAd
- (instancetype)initWithSlotID:(NSString *)slot adSize:(CGSize)size rootViewController:(UIViewController *)vc { return nil; }
- (void)loadAdData { }
- (void)showSplashViewInWindow:(UIWindow *)w { }
%end

// 广点通开屏
%hook GDTSplashAd
- (instancetype)initWithPlacementId:(NSString *)pid { return nil; }
- (instancetype)initWithPlacementId:(NSString *)pid token:(NSString *)t { return nil; }
- (void)loadAd { }
- (void)loadAdAndShowInWindow:(UIWindow *)w { }
- (void)showAdInWindow:(UIWindow *)w withBottomView:(UIView *)bv skipView:(UIView *)sv { }
%end

// 快手开屏
%hook KSSplashAd
- (instancetype)initWithPosId:(NSString *)posId { return nil; }
- (void)loadAdData { }
- (void)showInWindow:(UIWindow *)window { }
%end

// 章鱼开屏
%hook OctAdSplash
- (void)loadAd { }
- (void)showInWindow:(UIWindow *)w { }
%end

// 美数开屏
%hook MSAdSplash
- (void)loadAd { }
- (void)showInWindow:(UIWindow *)w { }
%end

// 趣盟开屏
%hook QMSplash
- (void)loadAd { }
- (void)showInWindow:(UIWindow *)w { }
- (void)loadAndShow { }
%end

// AdGain开屏
%hook AdGainSplashAd
- (void)loadAd { }
- (void)showInWindow:(UIWindow *)w { }
%end

// 雷速自定义广告
%hook LSCodeAdFeedView
- (instancetype)initWithFrame:(CGRect)frame { return nil; }
- (instancetype)init { return nil; }
- (instancetype)initWithCoder:(NSCoder *)coder { return nil; }
- (void)loadAd { }
- (void)showAd { }
%end

%hook LSCodeAdFeedListView
- (instancetype)initWithFrame:(CGRect)frame { return nil; }
- (instancetype)init { return nil; }
- (void)loadData { }
- (void)reloadData { }
%end

%hook LSCodeAdFeedRelatedView
- (instancetype)initWithFrame:(CGRect)frame { return nil; }
- (instancetype)init { return nil; }
- (void)loadAd { }
%end

// ⭐ 雷速开屏广告 — 之前漏了!
%hook LSCodeSplashAd
- (instancetype)init { return nil; }
- (instancetype)initWithFrame:(CGRect)frame { return nil; }
- (instancetype)initWithCoder:(NSCoder *)coder { return nil; }
- (void)loadSplashAdWithPlacementID:(NSString *)pid { }
- (void)loadSplashAd { }
- (void)showSplashAd { }
- (void)showSplash { }
- (void)show { }
- (void)showInWindow:(UIWindow *)w { }
- (void)dismiss { }
- (void)loadAd { }
- (void)render { }
- (void)display { }
%end

// ⭐ 穿山甲开屏加载器
%hook CSJSplashAdLoader
- (instancetype)init { return nil; }
- (void)loadSplashAd { }
- (void)loadAd { }
- (void)showSplashAd { }
%end

// ⭐ 美数开屏管理器
%hook MSSplashAdLoaderManager
+ (instancetype)sharedInstance { return nil; }
- (void)loadSplashAd { }
- (void)showSplashAd { }
- (void)loadAd { }
%end

// ═══════════════════════════════
// Hook UIWindow: 拦截广告view加在window上
// ═══════════════════════════════

static void hook_window_addSubview(id self, SEL _cmd, UIView *view) {
    // 检查view或它的class名
    const char *className = class_getName([view class]);
    NSString *cn = [NSString stringWithUTF8String:className];

    // 如果view是广告类，不添加
    if (isAdClass([view class])) {
        NSLog(@"[海鸥去广告] 拦截广告View: %@", cn);
        return; // 不调用原始addSubview
    }

    // 检查view的父类链
    Class superCls = class_getSuperclass([view class]);
    while (superCls) {
        if (isAdClass(superCls)) {
            NSLog(@"[海鸥去广告] 拦截广告View(父类匹配): %@ -> %s", cn, class_getName(superCls));
            return;
        }
        superCls = class_getSuperclass(superCls);
    }

    // 调用原始addSubview (用objc_msgSend)
    ((void (*)(id, SEL, UIView *))objc_msgSend)(self, @selector(seagull_original_addSubview:), view);
}

// ═══════════════════════════════
// Constructor
// ═══════════════════════════════

%ctor {
    @autoreleasepool {
        NSLog(@"============================================");
        NSLog(@"[海鸥去广告v2] 雷速体育 v11.0.1 去广告dylib加载中...");
        NSLog(@"============================================");

        // Phase 1: 显式hook已知广告类
        // TopOn
        %init;
        // Theos的%hook宏需要通过%init触发生效
        // 但由于上面用了%hook声明，这些已经会被框架初始化
        // 我们这里显式init所有组

        // Phase 2: 动态扫描所有已加载类
        scanAndHookAllClasses();

        // Phase 3: 延迟扫描 — 广告SDK的framework可能在app启动后才load
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.5 * NSEC_PER_SEC)),
                       dispatch_get_main_queue(), ^{
            scanAndHookAllClasses();
            NSLog(@"[海鸥去广告v2] 第1次延迟扫描完成");
        });
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(1.5 * NSEC_PER_SEC)),
                       dispatch_get_main_queue(), ^{
            scanAndHookAllClasses();
            NSLog(@"[海鸥去广告v2] 第2次延迟扫描完成");
        });
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(3.0 * NSEC_PER_SEC)),
                       dispatch_get_main_queue(), ^{
            scanAndHookAllClasses();
            NSLog(@"[海鸥去广告v2] 第3次延迟扫描完成");
        });

        // Phase 4: Hook所有UIView的addSubview，拦截广告view
        // 更温和的方式 — 用method swizzling替换addSubview
        // (这个在纯Theos环境中不太方便，我们通过不hook addSubview来避免bug)

        // Phase 5: 每5秒重新扫描，确保延迟加载的广告framework也被hook
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(5.0 * NSEC_PER_SEC)),
                       dispatch_get_main_queue(), ^{
            scanAndHookAllClasses();
            NSLog(@"[海鸥去广告v2] 第4次延迟扫描完成");
        });

        NSLog(@"[海鸥去广告v2] ✅ dylib加载完成");
    }
}
