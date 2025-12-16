// 비밀번호 변경 페이지 JavaScript

document.addEventListener('DOMContentLoaded', () => {
  // 인증 확인
  if (!isAuthenticated()) {
    redirectToLogin();
    return;
  }

  const changePasswordForm = document.getElementById('changePasswordForm');
  const newPasswordInput = document.getElementById('newPassword');
  const logoutBtn = document.getElementById('logoutBtn');

  // 비밀번호 강도 체크 리스너
  if (newPasswordInput) {
    newPasswordInput.addEventListener('input', () => {
      checkPasswordStrength(newPasswordInput.value);
    });
  }

  // 폼 제출
  if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', handleChangePassword);
  }

  // 로그아웃
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
});

async function handleChangePassword(e) {
  e.preventDefault();

  // 모든 에러 메시지 초기화
  clearErrors('errorContainer');
  clearFieldError('currentPassword');
  clearFieldError('newPassword');
  clearFieldError('confirmPassword');

  // 폼 데이터 수집
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  // 유효성 검사
  let hasError = false;

  if (!currentPassword) {
    showFieldError('currentPassword', '현재 비밀번호를 입력해주세요.');
    hasError = true;
  }

  if (!newPassword) {
    showFieldError('newPassword', '새 비밀번호를 입력해주세요.');
    hasError = true;
  } else if (newPassword.length < 6) {
    showFieldError('newPassword', '비밀번호는 6자 이상이어야 합니다.');
    hasError = true;
  }

  if (!confirmPassword) {
    showFieldError('confirmPassword', '비밀번호 확인을 입력해주세요.');
    hasError = true;
  }

  if (newPassword !== confirmPassword) {
    showFieldError('confirmPassword', '비밀번호가 일치하지 않습니다.');
    hasError = true;
  }

  if (currentPassword === newPassword) {
    showFieldError('newPassword', '새 비밀번호는 현재 비밀번호와 달라야 합니다.');
    hasError = true;
  }

  if (hasError) {
    return;
  }

  // 제출 버튼 비활성화
  const submitBtn = document.querySelector('.save-button');
  submitBtn.disabled = true;
  const originalText = submitBtn.textContent;
  submitBtn.textContent = '변경 중...';

  try {
    await changePassword(currentPassword, newPassword, confirmPassword);

    // 성공 메시지 표시
    showSuccess('비밀번호가 변경되었습니다!');

    // 폼 초기화
    document.getElementById('changePasswordForm').reset();

    // 2초 후 프로필 페이지로 리다이렉트
    setTimeout(() => {
      window.location.href = '/profile';
    }, 2000);

  } catch (error) {
    showError(error.message || '비밀번호 변경 중 오류가 발생했습니다.');
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

// 로그아웃 처리
async function handleLogout() {
  if (!confirm('정말 로그아웃 하시겠습니까?')) {
    return;
  }

  try {
    await logout();
    
    // 토큰 삭제
    tokenStorage.clear();

    // 로그인 페이지로 리다이렉트
    redirectToLogin();

  } catch (error) {
    // 로그아웃 API 실패해도 로컬 토큰은 삭제
    tokenStorage.clear();
    redirectToLogin();
  }
}