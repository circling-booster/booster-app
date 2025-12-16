// API 설정 및 공통 함수

const API_BASE_URL = window.location.origin;

// 토큰 저장소
const tokenStorage = {
  getAccessToken() {
    return localStorage.getItem('accessToken');
  },

  setAccessToken(token) {
    localStorage.setItem('accessToken', token);
  },

  getRefreshToken() {
    return localStorage.getItem('refreshToken');
  },

  setRefreshToken(token) {
    localStorage.setItem('refreshToken', token);
  },

  getUserId() {
    return localStorage.getItem('userId');
  },

  setUserId(userId) {
    localStorage.setItem('userId', userId);
  },

  getUserData(key) {
    const data = localStorage.getItem('userData');
    if (!data) return null;
    const parsed = JSON.parse(data);
    return key ? parsed[key] : parsed;
  },

  setUserData(data) {
    localStorage.setItem('userData', JSON.stringify(data));
  },

  clear() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('userData');
  }
};

// API 호출 함수
async function apiCall(endpoint, options = {}) {
  const {
    method = 'GET',
    body = null,
    headers = {},
    requiresAuth = true
  } = options;

  const defaultHeaders = {
    'Content-Type': 'application/json'
  };

  if (requiresAuth) {
    const token = tokenStorage.getAccessToken();
    if (!token) {
      window.location.href = '/login';
      throw new Error('No token found');
    }
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  const fetchOptions = {
    method,
    headers: { ...defaultHeaders, ...headers }
  };

  if (body) {
    fetchOptions.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api${endpoint}`, fetchOptions);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'An error occurred');
    }

    return data;
  } catch (error) {
    throw error;
  }
}

// 회원가입
async function register(email, password, firstName, lastName) {
  return await apiCall('/auth/register', {
    method: 'POST',
    body: { email, password, firstName, lastName },
    requiresAuth: false
  });
}

// 로그인
async function login(email, password) {
  return await apiCall('/auth/login', {
    method: 'POST',
    body: { email, password },
    requiresAuth: false
  });
}

// 프로필 조회
async function getProfile() {
  return await apiCall('/auth/profile', {
    method: 'GET',
    requiresAuth: true
  });
}

// 프로필 업데이트
async function updateProfile(firstName, lastName) {
  return await apiCall('/auth/profile', {
    method: 'PUT',
    body: { firstName, lastName },
    requiresAuth: true
  });
}

// 비밀번호 변경
async function changePassword(currentPassword, newPassword, confirmPassword) {
  return await apiCall('/auth/change-password', {
    method: 'POST',
    body: { currentPassword, newPassword, confirmPassword },
    requiresAuth: true
  });
}

// 로그아웃
async function logout() {
  return await apiCall('/auth/logout', {
    method: 'POST',
    requiresAuth: true
  });
}

// UI 헬퍼 함수들

// 에러 메시지 표시
function showError(message, containerId = 'errorContainer') {
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = `<div class="error-box">${message}</div>`;
    container.classList.add('show');
  }
}

// 성공 메시지 표시
function showSuccess(message, containerId = 'successMessage') {
  const container = document.getElementById(containerId);
  if (container) {
    container.textContent = message;
    container.classList.add('show');
    
    setTimeout(() => {
      container.classList.remove('show');
    }, 3000);
  }
}

// 에러 메시지 숨기기
function clearErrors(containerId = 'errorContainer') {
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = '';
    container.classList.remove('show');
  }
}

// 필드 에러 표시
function showFieldError(fieldId, message) {
  const errorElement = document.getElementById(`${fieldId}Error`);
  if (errorElement) {
    errorElement.textContent = message;
  }
}

// 필드 에러 숨기기
function clearFieldError(fieldId) {
  const errorElement = document.getElementById(`${fieldId}Error`);
  if (errorElement) {
    errorElement.textContent = '';
  }
}

// 비밀번호 표시/숨김 토글
function togglePassword(fieldId) {
  const field = document.getElementById(fieldId);
  if (field) {
    field.type = field.type === 'password' ? 'text' : 'password';
  }
}

// 비밀번호 강도 체크
function checkPasswordStrength(password) {
  if (!password) {
    return null;
  }

  const strengthElement = document.getElementById('passwordStrength');
  if (!strengthElement) return;

  strengthElement.classList.add('show');

  // 강도 판단 로직
  let strength = 0;
  
  if (password.length >= 6) strength++;
  if (password.length >= 8) strength++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[!@#$%^&*]/.test(password)) strength++;

  strengthElement.classList.remove('weak', 'medium', 'strong');

  if (strength < 3) {
    strengthElement.classList.add('weak');
    strengthElement.innerHTML = '<div class="password-strength-bar"></div>';
  } else if (strength < 4) {
    strengthElement.classList.add('medium');
    strengthElement.innerHTML = '<div class="password-strength-bar"></div>';
  } else {
    strengthElement.classList.add('strong');
    strengthElement.innerHTML = '<div class="password-strength-bar"></div>';
  }
}

// 폼 유효성 검사
function validateEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

function validatePassword(password) {
  return password && password.length >= 6;
}

// 날짜 포맷팅
function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// 인증 확인
function isAuthenticated() {
  return tokenStorage.getAccessToken() !== null;
}

// 로그인 페이지로 리다이렉트
function redirectToLogin() {
  window.location.href = '/login';
}

// 프로필 페이지로 리다이렉트
function redirectToProfile() {
  window.location.href = '/profile';
}