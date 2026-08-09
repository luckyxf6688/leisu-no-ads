# 雷速体育去广告 dylib

通过 GitHub Actions 自动编译 iOS dylib，注入到雷速体育 IPA 中去广告。

## 编译

推送到 GitHub，Actions 自动触发，下载 artifact 即可。

## 使用

```bash
# 1. 解压原始IPA
unzip 雷速体育.ipa -d extract

# 2. 注入 dylib
insert_dylib @executable_path/leisu_no_ads.dylib extract/Payload/leisu.app/leisu extract/Payload/leisu.app/leisu_patched
mv extract/Payload/leisu.app/leisu_patched extract/Payload/leisu.app/leisu

# 3. 复制 dylib
cp leisu_no_ads.dylib extract/Payload/leisu.app/

# 4. 重打包
cd extract && zip -r ../leisu_no_ads.ipa Payload/

# 5. TrollStore 安装
```

## 注入说明

dylib 是 arm64/arm64e 的，只能真机用。模拟器不行。
