// ============================================
// 雷速体育去广告 dylib - Theos Logos 源码
// 编译: make package (macOS + Theos)
// 注入: insert_dylib @executable_path/leisu_no_ads.dylib leisu leisu_patched
// ============================================

#import <UIKit/UIKit.h>
#import <objc/runtime.h>

// ═══════════════════════════════
// 穿山甲 CSJ / BUAd SDK
// ═══════════════════════════════

%hook BUNativeExpressAdManager
- (instancetype)initWithSlot:(id)slot adSize:(CGSize)size {
    return nil;
}
- (void)loadAdData {}
- (void)loadAdDataWithCount:(NSInteger)count {}
- (void)render {}
%end

%hook BUSplashAdView
- (instancetype)initWithSlotID:(NSString *)slot adSize:(CGSize)size rootViewController:(UIViewController *)vc {
    return nil;
}
- (void)loadAdData {}
- (void)showSplashViewInWindow:(UIWindow *)w {}
%end

%hook BUNativeExpressBannerView
- (instancetype)initWithSlotID:(NSString *)slot rootViewController:(UIViewController *)vc adSize:(CGSize)size {
    return nil;
}
- (void)loadAdData {}
%end

%hook BUNativeExpressInterstitialAd
- (instancetype)initWithSlotID:(NSString *)slot adSize:(CGSize)size {
    return nil;
}
- (void)loadAdData {}
- (void)showAdFromRootViewController:(UIViewController *)vc {}
%end

%hook BURewardedVideoAd
- (instancetype)initWithSlotID:(NSString *)slot rewardedVideoModel:(id)model {
    return nil;
}
- (void)loadAdData {}
- (BOOL)showAdFromRootViewController:(UIViewController *)vc { return NO; }
%end

%hook BUInterstitialAd
- (instancetype)initWithSlotID:(NSString *)slot adSize:(CGSize)size {
    return nil;
}
- (void)loadAdData {}
- (void)showAdFromRootViewController:(UIViewController *)vc {}
%end

%hook BUFullscreenVideoAd
- (instancetype)initWithSlotID:(NSString *)slot { return nil; }
- (void)loadAdData {}
- (BOOL)showAdFromRootViewController:(UIViewController *)vc { return NO; }
%end

// ═══════════════════════════════
// 腾讯广点通 GDT
// ═══════════════════════════════

%hook GDTSplashAd
- (instancetype)initWithPlacementId:(NSString *)pid { return nil; }
- (instancetype)initWithPlacementId:(NSString *)pid token:(NSString *)t { return nil; }
- (void)loadAd {}
- (void)loadAdAndShowInWindow:(UIWindow *)w {}
- (void)showAdInWindow:(UIWindow *)w withBottomView:(UIView *)bv skipView:(UIView *)sv {}
%end

%hook GDTUnifiedNativeAd
- (instancetype)initWithPlacementId:(NSString *)pid { return nil; }
- (void)loadAdWithAdCount:(NSInteger)c {}
- (void)loadAd {}
- (NSArray *)dataObject { return nil; }
%end

%hook GDTRewardVideoAd
- (instancetype)initWithPlacementId:(NSString *)pid { return nil; }
- (void)loadAd {}
- (void)showAdFromRootViewController:(UIViewController *)vc {}
%end

%hook GDTUnifiedInterstitialAd
- (instancetype)initWithPlacementId:(NSString *)pid { return nil; }
- (void)loadAd {}
- (void)presentAdFromRootViewController:(UIViewController *)vc {}
%end

%hook GDTUnifiedBannerView
- (instancetype)initWithPlacementId:(NSString *)pid rootViewController:(UIViewController *)vc bannerSize:(CGSize)s {
    return nil;
}
- (void)loadAd {}
%end

// ═══════════════════════════════
// AnyThink / TopOn
// ═══════════════════════════════
// (这些类在 AnyThinkSDK.bundle 被删后不会加载, 但以防万一)

%hook ATAdNative
- (void)loadAd {}
- (void)loadAdWithConfiguration:(id)cfg {}
%end

%hook ATAdSplash
- (void)loadAd {}
- (void)showInWindow:(UIWindow *)w {}
%end

%hook ATAdBanner
- (void)loadAd {}
%end

%hook ATAdInterstitial
- (void)loadAd {}
- (void)showAdFromRootViewController:(UIViewController *)vc {}
%end

%hook ATAdRewardedVideo
- (void)loadAd {}
- (void)showAdFromRootViewController:(UIViewController *)vc {}
%end

// ═══════════════════════════════
// OctAd 章鱼广告
// ═══════════════════════════════

%hook OctAdSplash
- (void)loadAd {}
- (void)showInWindow:(UIWindow *)w {}
%end

%hook OctAdNative
- (void)loadAd {}
- (void)loadAdWithCount:(NSInteger)c {}
- (NSArray *)data { return nil; }
%end

%hook OctAdBanner
- (void)loadAd {}
%end

%hook OctAdInterstitial
- (void)loadAd {}
- (void)show {}
%end

%hook OctAdReward
- (void)loadAd {}
- (void)show {}
%end

// ═══════════════════════════════
// AdGain
// ═══════════════════════════════

%hook AdGainSDKManager
+ (instancetype)sharedInstance { return nil; }
+ (void)startWithAppId:(NSString *)appId {}
- (void)start {}
%end

%hook AdGainSplashAd
- (void)loadAd {}
- (void)showInWindow:(UIWindow *)w {}
%end

%hook AdGainNativeAd
- (void)loadAd {}
- (NSArray *)data { return nil; }
%end

%hook AdGainBannerAd
- (void)loadAd {}
%end

%hook AdGainInterstitialAd
- (void)loadAd {}
- (void)show {}
%end

// ═══════════════════════════════
// QMAd 趣盟
// ═══════════════════════════════

%hook QMSplash
- (void)loadAd {}
- (void)showInWindow:(UIWindow *)w {}
- (void)loadAndShow {}
%end

%hook QMNative
- (void)loadAd {}
- (void)loadAdWithCount:(NSInteger)c {}
- (NSArray *)data { return nil; }
%end

%hook QMReward
- (void)loadAd {}
- (void)show {}
%end

%hook QMInterstitial
- (void)loadAd {}
- (void)show {}
%end

%hook QMBanner
- (void)loadAd {}
%end

// ═══════════════════════════════
// Kuaishou 快手
// ═══════════════════════════════

%hook KSInterstitial
- (void)loadAd {}
- (void)show {}
%end

%hook KSNative
- (void)loadAd {}
- (NSArray *)data { return nil; }
%end

%hook KSBanner
- (void)loadAd {}
%end

%hook KSSplash
- (void)loadAd {}
- (void)show {}
%end

// ═══════════════════════════════
// 雷速自定义信息流广告
// ═══════════════════════════════

%hook LSCodeAdFeedView
- (instancetype)initWithFrame:(CGRect)frame { return nil; }
- (instancetype)init { return nil; }
- (instancetype)initWithCoder:(NSCoder *)coder { return nil; }
- (void)loadAd {}
- (void)showAd {}
%end

%hook LSCodeAdFeedListView
- (instancetype)initWithFrame:(CGRect)frame { return nil; }
- (instancetype)init { return nil; }
- (void)loadData {}
- (void)reloadData {}
%end

%hook LSCodeAdFeedRelatedView
- (instancetype)initWithFrame:(CGRect)frame { return nil; }
- (instancetype)init { return nil; }
- (void)loadAd {}
%end

// ═══════════════════════════════
// SKAdNetwork 归因拦截
// ═══════════════════════════════

%hook SKAdNetwork
+ (void)registerAppForAdNetworkAttribution {}
+ (void)updatePostbackConversionValue:(NSInteger)v completionHandler:(void(^)(NSError *))h {}
%end

// ═══════════════════════════════
// Constructor
// ═══════════════════════════════

%ctor {
    @autoreleasepool {
        NSLog(@"============================================");
        NSLog(@"[海鸥去广告] 雷速体育 v11.0.1 去广告dylib已加载");
        NSLog(@"[海鸥去广告] 拦截: CSJ/GDT/AnyThink/OctAd/AdGain/QMAd/快手/LSCodeAdFeed/SKAdNetwork");
        NSLog(@"============================================");
    }
}
