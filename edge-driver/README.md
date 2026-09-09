# KOCOM Edge Driver skeleton

이 폴더는 SmartThings Hub에서 실행될 KOCOM Edge Driver용 **안전한 뼈대**입니다.

현재 상태:

- `profiles/`에 조명/난방/환기/콘센트용 표준 capability 프로필만 정의되어 있습니다.
- `src/kocom_protocol.lua`의 확정 패킷 테이블은 비어 있습니다.
- `src/init.lua`에는 LAN/RS485 송신 구현이 없습니다.
- 따라서 현재 Edge Driver는 어떤 KOCOM raw 패킷도 송신하지 않습니다.

구현 순서:

1. `../docs/kocom_protocol.md`에 캡처/검증된 패킷을 기록합니다.
2. 패킷 항목을 `CONFIRMED`로 승인합니다.
3. 해당 항목만 `src/kocom_protocol.lua`에 인코더로 추가합니다.
4. 별도 검토 후 RS485-LAN 브리지 transport 계층을 추가합니다.
5. 실제 장치에서 읽기 → 상태 이벤트 → 제한된 쓰기 순서로 검증합니다.
