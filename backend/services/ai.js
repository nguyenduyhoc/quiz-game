/**
 * Dịch vụ AI điều chỉnh độ khó thích ứng
 *
 * Xác định cấp độ khó tiếp theo dựa trên
 * tỉ lệ trả lời đúng của người chơi (đúng / tổng × 100).
 *
 * Quy tắc:
 *   độ chính xác > 80%  →  tăng cấp độ  (tối đa 5)
 *   độ chính xác < 50%  →  giảm cấp độ  (tối thiểu 1)
 *   50% ≤ độ chính xác ≤ 80%  →  giữ nguyên cấp độ hiện tại
 */

/**
 * Tính phần trăm độ chính xác từ số liệu thô.
 * Trả về 50 (trung lập) khi người chơi chưa trả lời câu nào.
 *
 * @param {number} correct  Tổng số câu trả lời đúng
 * @param {number} wrong    Tổng số câu trả lời sai
 * @returns {number}        Độ chính xác theo phần trăm (0–100)
 */
function calculateAccuracy(correct, wrong) {
  const total = correct + wrong;
  if (total === 0) return 50; // Chưa có lịch sử – bắt đầu ở mức trung lập
  return (correct / total) * 100;
}

/**
 * Trả về cấp độ khó tiếp theo sau mỗi lượt trả lời.
 *
 * @param {number} currentLevel  Cấp độ hiện tại (1–5)
 * @param {number} correct       Tổng số câu đúng (đã cập nhật)
 * @param {number} wrong         Tổng số câu sai  (đã cập nhật)
 * @returns {number}             Cấp độ tiếp theo (1–5)
 */
function getNextDifficulty(currentLevel, correct, wrong) {
  const accuracy = calculateAccuracy(correct, wrong);

  if (accuracy > 80 && currentLevel < 5) {
    // Người chơi làm rất tốt – tăng độ khó
    return currentLevel + 1;
  } else if (accuracy < 50 && currentLevel > 1) {
    // Người chơi đang gặp khó khăn – giảm độ khó
    return currentLevel - 1;
  }

  // Độ chính xác trong vùng an toàn 50–80% – giữ nguyên cấp độ
  return currentLevel;
}

module.exports = { getNextDifficulty, calculateAccuracy };
