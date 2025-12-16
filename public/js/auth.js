// 회원가입 페이지 JavaScript

document.addEventListener('DOMContentLoaded', () => {
  const registerForm = document.getElementById('registerForm');
  const passwordInput = document.getElementById('password');

  // 비밀번호 강도 체크 리스너
  if (passwordInput) {
    passwordInput.addEventListener('input', () => {
      checkPasswordStrength(passwordInput.value);
    });
  }

  // 폼 제출
  if (registerForm) {
    registerForm.addEventListener('submit', handleRegister);
  }
});

async function handleRegister(e) {
  e.preventDefault();

  // 모든 에러 메시지 초기화
  clearErrors('errorContainer');
  clearFieldError('firstName');
  clearFieldError('lastName');
  clearFieldError('email');
  clearFieldError('password');
  clearFieldError('confirmPassword');

  // 폼 데이터 수집
  const firstName = document.getElementById('firstName').value.trim();
  const lastName = document.getElementById('lastName').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

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
  } else if (!validatePassword(password)) {
    showFieldError('password', '비밀번호는 6자 이상이어야 합니다.');
    hasError = true;
  }

  if (password !== confirmPassword) {
    showFieldError('confirmPassword', '비밀번호가 일치하지 않습니다.');
    hasError = true;
  }

  if (hasError) {
    return;
  }

  // 제출 버튼 비활성화
  const submitBtn = document.querySelector('.auth-button');
  submitBtn.disabled = true;
  const originalText = submitBtn.textContent;
  submitBtn.textContent = '가입 중...';

  try {
    const response = await register(email, password, firstName, lastName);

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
    showSuccess('회원가입이 완료되었습니다!', 'successMessage');
    
    setTimeout(() => {
      redirectToProfile();
    }, 1500);

  } catch (error) {
    showError(error.message || '회원가입 중 오류가 발생했습니다.');
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}