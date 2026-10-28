# So sánh lịch sử INC-003 — 26/10/2026

Đây là dữ liệu cũ, không phải run revalidation mới. Hai plan mentah trong thư mục này ghi nhận **101,697 ms trước index** và **0,247 ms sau index**. Những số 118,829/0,349 ms và hệ số 340x trong diễn giải cũ không khớp plan đã lưu nên không sử dụng.

Benchmark HTTP lịch sử: 40 connections, pipelining 5, 15 giây. Theo bảng autocannon đã lưu: 97,87 → 534,4 req/s; average latency 1926,47 → 369,83 ms. Dòng 2k/8k requests là số hiển thị làm tròn, không được coi là số đếm chính xác. Không suy ra CPU hoặc giới hạn throughput vật lý chỉ từ một plan đơn lẻ.

Đọc [report hiện hành](../../incidents/INC-003-slow-query.md) để lấy benchmark/EXPLAIN mới với cấu hình nhất quán và metadata kiểm chứng. Index vẫn được giữ ngoài migraton baseline để tái hiện insiden.
