# ============================================
# 雷速体育去广告 dylib
# GitHub Actions 编译用 Makefile
# ============================================

ARCHS = arm64 arm64e
TARGET = iphone:clang:14.0:10.0

include $(THEOS)/makefiles/common.mk

LIBRARY_NAME = leisu_no_ads
leisu_no_ads_FILES = Tweak.xm
leisu_no_ads_CFLAGS = -fobjc-arc
leisu_no_ads_FRAMEWORKS = Foundation UIKit
leisu_no_ads_INSTALL_PATH = /usr/lib

include $(THEOS_MAKE_PATH)/library.mk
