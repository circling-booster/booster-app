const width = captchaElement.offsetWidth;
const height = captchaElement.offsetHeight;

const canvas = document.createElement('canvas');
canvas.width = width;
canvas.height = height;
const ctx = canvas.getContext('2d');

// 배경색 설정
const bodyStyle = window.getComputedStyle(document.body);
ctx.fillStyle = bodyStyle.backgroundColor || '#ffffff';
ctx.fillRect(0, 0, width, height);

// 이미지 그리기
const img = new Image();
img.crossOrigin = 'anonymous';
img.addEventListener('load', () => {
  // 이미지를 요소의 실제 크기에 맞춰 그리기
  ctx.drawImage(img, 0, 0, width, height);
  
  // 캡처 완료
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `captcha_${Date.now()}.png`;
    link.click();
    URL.revokeObjectURL(url);
    console.log('화면 렌더링 그대로 캡처:', blob);
  }, 'image/png');
});
img.src = captchaElement.src;