# AGENTS.md

## ระบบนี้ทำอะไร
- ชื่อระบบ: KONGA-OSS
- หน้าที่สั้นๆ: KONG Admin UI Management สำหรับตั้งค่าคอนฟิค Kong API Gateway

## Stack
- TypeScript / Nuxt 3 / PostgreSQL:

## โครงสร้างหลัก
- `/` —
- `tests/` —

## คำสั่ง
- เทส: npm run test
- lint:
- dev server: npm run dev

## Git
- default branch: main
- รูปแบบ branch: `feat/<short-name>`, `fix/<short-name>`
- ห้าม push `main` / `master`
- ห้าม commit หรือเปิด MR ถ้าผู้ใช้ไม่ได้สั่ง

## การติดตามงาน
- tracker: GitHub
- คำสั่งสร้าง issue:
  - GitHub: `gh issue create --title "..." --body "..."`
- หลังอนุมัติแผน ให้ Agent หลักเปิด issue ด้วยคำสั่งของ tracker ที่เลือก ก่อนเรียก developer
- เนื้อหา issue ใส่แผนและเกณฑ์ผ่าน แล้วส่งเลข issue ให้ developer
- planner ห้ามเปิด issue
- อย่าเปิด issue ตอนยังรออนุมัติ
- อย่าเปิด PR / MR และอย่า push ถ้าผู้ใช้ไม่ได้สั่ง

## สิ่งที่ห้ามทำใน repo นี้
-

## โดเมนเฉพาะงาน
-
