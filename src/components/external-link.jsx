// EXTERNAL LINK - Mở link ngoài app bằng WebBrowser
// ================================================================
// Comment tiếng Việt được đặt phía trên từng khối để giải thích vai trò code.
// Logic hiện tại được giữ nguyên, chỉ bổ sung mô tả cho dễ đọc/bảo trì.
// ================================================================

import { Link } from "expo-router";
import {
  openBrowserAsync,
  WebBrowserPresentationStyle,
} from "expo-web-browser";

// ExternalLink: Link ngoài app.
// Web: để Link mở target="_blank" theo hành vi trình duyệt.
// Native: chặn navigation mặc định rồi mở href bằng expo-web-browser trong in-app browser.
export function ExternalLink({ href, ...rest }) {
  return (
    <Link
      target="_blank"
      {...rest}
      href={href}
      onPress={async (event) => {
        if (process.env.EXPO_OS !== "web") {
          // Native không dùng router nội bộ cho URL ngoài; chặn Link mặc định trước.
          event.preventDefault();
          // Gửi href sang expo-web-browser để mở trang ngoài app bằng browser tích hợp.
          await openBrowserAsync(href, {
            presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
          });
        }
      }}
    />
  );
}
