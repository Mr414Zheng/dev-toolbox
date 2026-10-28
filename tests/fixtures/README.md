# 固定图像测试样例

这些 PNG 由 `zxing-wasm 3.1.6` 的 **ZXing-C++ writer** 生成，与应用使用的 JsBarcode / qrcode 生成器独立。用于固定输入回归，测试时不重新生成。

生成脚本：`node scripts/generate-fixtures.mjs`。所有样例有静区，scale=3。

| 文件 | 制式 | 原文 |
| --- | --- | --- |
| qr-reference.png | QR Code | `dev-toolbox reference / 中文 😀` |
| code128-reference.png | Code 128 | `REF-00128` |
| code39-reference.png | Code 39 | `REF+39` |
| ean13-reference.png | EAN-13 | `5901234123457` |
| ean8-reference.png | EAN-8 | `96385074` |
| upca-reference.png | UPC-A | `036000291452`（同时允许 EAN-13 时可识别为等价 `0036000291452`） |

参考实现：https://github.com/Sec-ant/zxing-wasm ，https://github.com/zxing-cpp/zxing-cpp 。这些是合成测试数据，不含用户内容。
