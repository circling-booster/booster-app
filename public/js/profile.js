// 프로필 페이지 JavaScript

document.addEventListener('DOMContentLoaded', () => {
  // 인증 확인
  if (!isAuthenticated()) {
    redirectToLogin();
    return;
  }

  // 프로필 로드
  loadProfile();

  // 이벤트 리스너
  const editBtn = document.getElementById('editBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const editForm = document.getElementById('editForm');
  const profileInfo = document.getElementById('profileInfo');
  const logoutBtn = document.getElementById('logoutBtn');

  if (editBtn) {
    editBtn.addEventListener('click', showEditForm);
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      editForm.style.display = 'none';
      profileInfo.style.display = 'flex';
    });
  }

  if (editForm) {
    editForm.addEventListener('submit', handleProfileUpdate);
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
});

// 프로필 로드
async function loadProfile() {
  try {
    const profile = await getProfile();

    // UI 업데이트
    document.getElementById('emailDisplay').textContent = profile.email || '-';
    document.getElementById('firstNameDisplay').textContent = profile.firstName || '-';
    document.getElementById('lastNameDisplay').textContent = profile.lastName || '-';
    document.getElementById('createdAtDisplay').textContent = formatDate(profile.createdAt);
    document.getElementById('updatedAtDisplay').textContent = formatDate(profile.updatedAt);

    // 폼에 데이터 채우기
    document.getElementById('firstName').value = profile.firstName || '';
    document.getElementById('lastName').value = profile.lastName || '';

  } catch (error) {
    showError('프로필을 불러올 수 없습니다.');
  }
}

// 수정 폼 표시
function showEditForm() {
  const editForm = document.getElementById('editForm');
  const profileInfo = document.getElementById('profileInfo');
  
  editForm.style.display = 'flex';
  profileInfo.style.display = 'none';

  // 에러 메시지 초기화
  clearErrors('errorContainer');
  clearFieldError('firstName');
  clearFieldError('lastName');
}

// 프로필 업데이트 처리
async function handleProfileUpdate(e) {
  e.preventDefault();

  // 에러 메시지 초기화
  clearErrors('errorContainer');
  clearFieldError('firstName');
  clearFieldError('lastName');

  const firstName = document.getElementById('firstName').value.trim();
  const lastName = document.getElementById('lastName').value.trim();

  // 유효성 검사
  let hasError = false;

  if (firstName.length > 100) {
    showFieldError('firstName', '이름은 100자 이하여야 합니다.');
    hasError = true;
  }

  if (lastName.length > 100) {
    showFieldError('lastName', '성은 100자 이하여야 합니다.');
    hasError = true;
  }

  if (hasError) {
    return;
  }

  // 제출 버튼 비활성화
  const submitBtn = document.querySelector('.save-button');
  submitBtn.disabled = true;
  const originalText = submitBtn.textContent;
  submitBtn.textContent = '저장 중...';

  try {
    await updateProfile(firstName, lastName);

    // 토큰 저장소 업데이트
    tokenStorage.setUserData({
      email: document.getElementById('emailDisplay').textContent,
      firstName: firstName,
      lastName: lastName
    });

    // 프로필 리로드
    await loadProfile();

    // 폼 숨기기
    document.getElementById('editForm').style.display = 'none';
    document.getElementById('profileInfo').style.display = 'flex';

    showSuccess('프로필이 업데이트되었습니다!');

  } catch (error) {
    showError(error.message || '프로필 업데이트 중 오류가 발생했습니다.');
  } finally {
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