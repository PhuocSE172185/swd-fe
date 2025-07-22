import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import './Login.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const Login = ({ show, onOpenRegister, onClose, onOpen }) => {
  console.log('Login component rendering...')
  
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    rememberMe: false
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState({})
  const [savedUserInfo, setSavedUserInfo] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    // Tự động mở modal nếu show=true
    if (show) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = '' };
  }, [show])

  // Load thông tin đã lưu khi component mount
  useEffect(() => {
    // Kiểm tra xem đã đăng nhập chưa
    // const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken')
    // XÓA: if (token) { navigate('/dashboard'); return; }

    // Kiểm tra có thông báo từ đăng xuất không
    const logoutMessage = sessionStorage.getItem('logoutMessage')
    if (logoutMessage) {
      setMessage('Logged out successfully! Please log in again.')
      sessionStorage.removeItem('logoutMessage')
      setTimeout(() => setMessage(''), 3000)
    }

    const savedToken = localStorage.getItem('authToken')
    const savedUserData = localStorage.getItem('userData')
    const rememberLogin = localStorage.getItem('rememberLogin')
    
    if (savedToken && savedUserData && rememberLogin === 'true') {
      try {
        const userData = JSON.parse(savedUserData)
        setFormData(prev => ({
          ...prev,
          username: userData.username,
          rememberMe: true
        }))
        setSavedUserInfo(userData)
        console.log('Loaded saved login:', userData)
      } catch (error) {
        console.error('Error loading saved data:', error)
        // Xóa dữ liệu lỗi
        localStorage.removeItem('authToken')
        localStorage.removeItem('userData')
        localStorage.removeItem('rememberLogin')
      }
    }
  }, [navigate])

  // Hàm xóa thông tin đã lưu
  const clearSavedInfo = () => {
    localStorage.removeItem('authToken')
    localStorage.removeItem('userData')
    localStorage.removeItem('rememberLogin')
    setSavedUserInfo(null)
    setFormData({ username: '', password: '', rememberMe: false })
    setMessage('Saved information cleared!')
    setTimeout(() => setMessage(''), 3000)
  }

  // Validation function
  const validateForm = () => {
    const newErrors = {}
    
    // Kiểm tra username
    if (!formData.username) {
      newErrors.username = 'Username is required'
    }
    
    // Kiểm tra password
    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Xử lý thay đổi input
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    })
    // Xóa lỗi khi người dùng bắt đầu nhập
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: ''
      })
    }
  }

  // Xử lý submit form
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Kiểm tra validation trước khi submit
    if (!validateForm()) {
      return
    }
    
    setLoading(true)
    setMessage('')

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: formData.username, password: formData.password, grant_type: 'password' })
      });
      const data = await response.json();
      // Lấy access_token đúng theo cấu trúc trả về
      const access_token = data.access_token || (data.data && data.data.access_token);
      const apiUsername = data.username || (data.data && data.data.username);
      const last_name = data.last_name || (data.data && data.data.last_name);
      if (response.ok && access_token) {
        const username = apiUsername || formData.username;
        const userData = {
          username: username,
          last_name: last_name || '',
          loginTime: new Date().toISOString()
        };
        setMessage('Login successful!')
        sessionStorage.setItem('authToken', access_token)
        sessionStorage.setItem('userData', JSON.stringify(userData))
        if (formData.rememberMe) {
          localStorage.setItem('authToken', access_token)
          localStorage.setItem('userData', JSON.stringify(userData))
          localStorage.setItem('rememberLogin', 'true')
        } else {
          localStorage.removeItem('authToken')
          localStorage.removeItem('userData')
          localStorage.removeItem('rememberLogin')
        }
        setTimeout(() => {
          if (onClose) onClose();
        }, 1000)
      } else {
        const errorMessage = data.message || (data.data && data.data.message) || 'Login failed!';
        setErrors({ general: errorMessage })
        setMessage(errorMessage)
      }
    } catch (error) {
      const errorMessage = error.message || 'An error occurred. Please try again.'
      setMessage(errorMessage)
      setErrors({ general: errorMessage })
    } finally {
      setLoading(false)
    }
  }

  // Nếu không show thì không render modal
  if (!show) {
    return (
      <button className="login-btn" onClick={onOpen}>
        Login
      </button>
    )
  }

  return (
    <>
      <button className="login-btn" onClick={onOpen} style={{ display: 'none' }}>
        Login
      </button>
      <div className="login-overlay" onClick={onClose}>
        <div className="login-container" onClick={(e) => e.stopPropagation()}>
          <div className="login-form">
            <div className="login-header">
              <h2>Login</h2>
              <button className="close-btn" onClick={onClose}>×</button>
            </div>
            
            {/* Hiển thị thông tin đã lưu */}
            {savedUserInfo && (
              <div className="saved-info">
                <div className="saved-info-content">
                  <p><strong>Saved information:</strong></p>
                  <p>👤 {savedUserInfo.username}</p>
                  <button 
                    type="button" 
                    className="clear-saved-btn"
                    onClick={clearSavedInfo}
                  >
                    ❌ Clear saved info
                  </button>
                </div>
              </div>
            )}

            {/* Hiển thị thông báo */}
            {(message || errors.general) && (
              <div className={`message ${message && message.includes('success') ? 'success' : 'error'}`}>
                {message || errors.general}
              </div>
            )}

            {/* Hiển thị lỗi general */}
            {/* Đã gộp vào trên, xóa đoạn này đi */}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="username">Username:</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className={errors.username ? 'error' : ''}
                  placeholder="Enter your username"
                />
                {errors.username && <span className="error-message">{errors.username}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="password">Password:</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className={errors.password ? 'error' : ''}
                    placeholder="Enter your password"
                  />
                  <span
                    onClick={() => setShowPassword((prev) => !prev)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', userSelect: 'none' }}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? '👁' : '👁‍🗨'}
                  </span>
                </div>
                {errors.password && <span className="error-message">{errors.password}</span>}
              </div>

              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="rememberMe"
                    checked={formData.rememberMe}
                    onChange={handleChange}
                  />
                  <span className="checkmark"></span>
                  Remember me
                </label>
              </div>

              <button 
                type="submit" 
                className="submit-btn"
                disabled={loading}
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </form>

            <div className="form-links">
              <Link to="#" className="forgot-link">
                🔑 Forgot password?
              </Link>
              <span style={{ marginTop: 8 }}>
                Don&apos;t have an account?{' '}
                <button type="button" className="register-link" style={{ color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }} onClick={onOpenRegister}>
                  Register now
                </button>
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default Login 