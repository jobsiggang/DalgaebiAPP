// src/config/compositeConfig.js
export const canvasConfig = {
  imageFit: "stretch",
  saveOriginalPhoto: true, // 사진 촬영 시 원본 저장
  saveFolder: "달개비현장", // 휴대폰 저장 폴더명 (포토 앨범 아래)
  useLocation: true, // 위치정보 사용
  table: {
    backgroundColor: "#fff", // 표 배경색 (기본: 흰색)
    borderColor: "rgba(0,0,0,0.3)",
    borderWidth: 1,
    // font: "system", // 시스템 글꼴
    fontBasePx: 16, // 표 글자 기본 px (해상도 1024 기준)
    textColor: "#000", // 표 글씨색 (기본: 검정)
    cellPaddingX: 2,
    cellPaddingY: 0,
  }
};
//form 스키마르 확인할것