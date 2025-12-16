// 로그인 페이지 JavaScript

document.addEventListener('DOMContentLoaded', () => {
  // 이미 로그인 되어 있으면 프로필로 리다이렉트
  if (isAuthenticated()) {
    redirectToProfile();
    return;
  }

  const loginForm = document.getElementById('loginForm');
  
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
});

async function handleLogin(e) {
  e.preventDefault();

  // 모든 에러 메시지 초기화
  clearErrors('errorContainer');
  clearFieldError('email');
  clearFieldError('password');

  // 폼 데이터 수집
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  // 유효성 검사
  let hasError = false;

  if (!email) {
    showFieldError('email', '이메일을 입력해주세요.');
    hasError = true;
  } else if (!validateEmail(email)) {
    showFieldError('email', '올바른 이메일 형식을 입력해주세요.');
    hasError = true;
  }

  if (!password) {
    showFieldError('password', '비밀번호를 입력해주세요.');
    hasError = true;
  }

  if (hasError) {
    return;
  }

  // 제출 버튼 비활성화
  const submitBtn = document.querySelector('.auth-button');
  submitBtn.disabled = true;
  const originalText = submitBtn.textContent;
  submitBtn.textContent = '로그인 중...';

  try {
    const response = await login(email, password);

    // 토큰 저장
    tokenStorage.setAccessToken(response.accessToken);
    tokenStorage.setRefreshToken(response.refreshToken);
    tokenStorage.setUserId(response.userId);
    tokenStorage.setUserData({
      email: response.email,
      firstName: response.firstName,
      lastName: response.lastName
    });

    // 성공 메시지 표시 후 리다이렉트
    showSuccess('로그인되었습니다!', 'successMessage');
    
    setTimeout(() => {
      redirectToProfile();
    }, 1500);

  } catch (error) {
    showError(error.message || '로그인 중 오류가 발생했습니다.');
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}