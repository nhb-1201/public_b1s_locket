/* B1S-CDN-ARG: module mới (CDN jsDelivr) truyền "KEY|slug" qua $argument — không chứa dấu phẩy.
   Module cũ: worker vá đúng dòng placeholder `var LICENSE_KEY = "__LICENSE_KEY__";` ở đầu file —
   giữ tương thích ngược. Nếu $argument không hợp lệ → giữ nguyên giá trị được chèn sẵn.
   YÊU CẦU: file nguồn phải khai báo `var LICENSE_KEY = "__LICENSE_KEY__";` TRƯỚC khi include file này. */
try {
  var _rawArg = (typeof $argument !== "undefined" && $argument) ? String($argument) : "";
  var _argParts = _rawArg.split("|");
  var _argKey = (_argParts[0] || "").trim().toUpperCase();
  if (/^B1S-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(_argKey)) LICENSE_KEY = _argKey;
  var _argSlug = (_argParts[1] || "").trim().toLowerCase();
  if (typeof B1S_CONFIGS !== "undefined" && _argSlug && Object.prototype.hasOwnProperty.call(B1S_CONFIGS, _argSlug)) {
    B1S_CONFIG = B1S_CONFIGS[_argSlug];
  }
} catch (_e) { /* giữ giá trị chèn sẵn (module cũ) */ }
