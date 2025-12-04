export const canvasConfig = {
  width: 1920,
  height: 1080,
  imageFit: "cover",
  saveOriginalPhoto: true, // 사진 촬영 시 원본 저장
  saveFolder: "dalgaebi", // 휴대폰 저장 폴더명
  useLocation: true, // 위치정보 사용
  table: {
    widthRatio: 0.23,
    heightRatio: 0.25,
    backgroundColor: "#fff", // 표 배경색 (기본: 흰색)
    borderColor: "rgba(0,0,0,0.3)",
    borderWidth: 1,
    font: "system", // 시스템 글꼴
    textColor: "#000", // 표 글씨색 (기본: 검정)
    col1Ratio: 0.15,
    cellPaddingX: 2,
    cellPaddingY: 0,
    position: "bottomLeft", // 표 위치: 4개 모서리 중 하나 (bottomLeft, bottomRight, topLeft, topRight)
    size: "100%", // 표 크기: "100%", "120%", "150%"
    stylePreset: "white", // "white"(흰배경/검정글씨), "black"(검정배경/흰글씨)
  }
};