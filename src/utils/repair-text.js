// REPAIR TEXT - Sửa text bị lỗi mã hóa trước khi hiển thị
// ================================================================
// Comment tiếng Việt được đặt phía trên từng khối để giải thích vai trò code.
// Logic hiện tại được giữ nguyên, chỉ bổ sung mô tả cho dễ đọc/bảo trì.
// ================================================================

function shouldRepairText(value) {
  return /[\u00c3\u00c2\u00c4\u00c5\u00c6\u00d0\u00d1\u00d8\u00de\u00df\ufffd]|\u00e2\u20ac|\u00e2\u20ac\u2122|\u00e2\u20ac\u0153|\u00e2\u20ac\u009d|\u00e2\u20ac\u02dc|\u00e2\u20ac\u00a6/.test(value);
}

// decodeMojibakeOnce: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function decodeMojibakeOnce(value) {
  if (typeof value !== "string" || !value) {
    return value;
  }

  if (typeof TextDecoder === "function" && typeof Uint8Array === "function") {
    try {
      const bytes = Uint8Array.from(value, (char) => char.charCodeAt(0) & 0xff);
      return new TextDecoder("utf-8").decode(bytes);
    } catch {
      // Keep the original text if the environment cannot decode it.
    }
  }

  const buffer = globalThis.Buffer;

  if (buffer?.from) {
    try {
      return buffer.from(value, "latin1").toString("utf8");
    } catch {
      return value;
    }
  }

  return value;
}

// repairText: Thử sửa chuỗi bị lỗi encoding nhiều vòng
export function repairText(value) {
  if (typeof value !== "string" || !value) {
    return value;
  }

  let nextValue = value;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!shouldRepairText(nextValue)) {
      break;
    }

    const decodedValue = decodeMojibakeOnce(nextValue);

    if (decodedValue === nextValue) {
      break;
    }

    nextValue = decodedValue;
  }

  return nextValue;
}

// repairTextNode: Sửa text đệ quy cho object/array trước khi render
export function repairTextNode(node) {
  if (typeof node === "string") {
    return repairText(node);
  }

  if (Array.isArray(node)) {
    return node.map(repairTextNode);
  }

  return node;
}
