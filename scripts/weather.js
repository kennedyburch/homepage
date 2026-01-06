// Weather Widget Implementation
class WeatherWidget {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.options = {
      refreshInterval: 600000, // 10 minutes
      units: this.getStoredPreference('units') || 'metric', // Load saved preference
      showForecast: true,
      showHourly: true,
      forecastDays: 7,
      cacheTimeout: 300000, // 5 minutes
      ...options
    };
    
    if (!this.container) {
      console.error('Weather widget container not found');
      return;
    }
    
    this.locationName = null;
    this.cache = new Map();
    this.isLoading = false;
    this.init();
  }

  async init() {
    try {
      this.showLoading();
      await this.getUserLocation();
      await this.fetchWeatherData();
      this.setupAutoRefresh();
      this.setupAccessibility();
    } catch (error) {
      this.showError('Failed to load weather data');
      console.error('Weather widget initialization error:', error);
    }
  }

  getStoredPreference(key) {
    try {
      return localStorage.getItem(`weather-widget-${key}`);
    } catch (error) {
      console.warn('localStorage not available:', error);
      return null;
    }
  }

  setStoredPreference(key, value) {
    try {
      localStorage.setItem(`weather-widget-${key}`, value);
    } catch (error) {
      console.warn('localStorage not available:', error);
    }
  }

  getCacheKey(lat, lon) {
    return `weather-${lat.toFixed(4)}-${lon.toFixed(4)}`;
  }

  getCachedData(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.options.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  setCachedData(key, data) {
    this.cache.set(key, {
      data: data,
      timestamp: Date.now()
    });
  }

  showLoading() {
    this.container.innerHTML = `
      <div class="weather-loading">
        <div class="loading-spinner"></div>
        <div>🌤️ Loading weather...</div>
      </div>
    `;
  }

  async getUserLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        // Fallback to a default location (New York City)
        this.setDefaultLocation();
        resolve();
        return;
      }

      // Show location permission request
      this.container.innerHTML += `
        <div class="location-request">
          <small>Requesting location access for accurate weather...</small>
        </div>
      `;

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          this.latitude = position.coords.latitude;
          this.longitude = position.coords.longitude;
          await this.reverseGeocode();
          resolve();
        },
        (error) => {
          console.warn('Geolocation failed, using default location:', error);
          this.setDefaultLocation();
          resolve();
        },
        { 
          timeout: 15000, 
          enableHighAccuracy: true,
          maximumAge: 300000 // 5 minutes
        }
      );
    });
  }

  setDefaultLocation() {
    this.latitude = 40.7128;
    this.longitude = -74.0060;
    this.locationName = 'New York, NY';
  }

  async reverseGeocode() {
    try {
      // Using a simple reverse geocoding service
      const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${this.latitude}&longitude=${this.longitude}&localityLanguage=en`);
      const data = await response.json();
      
      this.locationName = data.city && data.countryCode ? 
        `${data.city}, ${data.countryCode}` : 
        `${this.latitude.toFixed(2)}, ${this.longitude.toFixed(2)}`;
    } catch (error) {
      console.warn('Reverse geocoding failed:', error);
      this.locationName = `${this.latitude.toFixed(2)}, ${this.longitude.toFixed(2)}`;
    }
  }

  async fetchWeatherData() {
    if (this.isLoading) return; // Prevent multiple concurrent requests
    
    try {
      this.isLoading = true;
      
      // Check cache first
      const cacheKey = this.getCacheKey(this.latitude, this.longitude);
      const cachedData = this.getCachedData(cacheKey);
      
      if (cachedData) {
        console.log('Using cached weather data');
        this.displayWeather(cachedData);
        return;
      }

      const baseUrl = 'https://api.open-meteo.com/v1/forecast';
      const params = new URLSearchParams({
        latitude: this.latitude,
        longitude: this.longitude,
        current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,apparent_temperature,precipitation,uv_index',
        hourly: 'temperature_2m,weather_code,precipitation_probability',
        daily: 'temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum,uv_index_max,wind_speed_10m_max',
        timezone: 'auto',
        forecast_days: this.options.forecastDays
      });
      
      const url = `${baseUrl}?${params}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Cache the data
      this.setCachedData(cacheKey, data);
      
      this.displayWeather(data);
      
    } catch (error) {
      console.error('Failed to fetch weather:', error);
      this.showError('Unable to load weather data. Please check your connection.');
    } finally {
      this.isLoading = false;
    }
  }

  displayWeather(data) {
    const { current, daily, hourly } = data;
    
    // Check for weather alerts
    const alertsHTML = this.checkWeatherAlerts(current, daily);
    
    // Create weather content HTML
    const weatherContent = `
      <div class="weather-content loaded" role="main" aria-label="Weather information">
        ${alertsHTML}
        
        <div class="weather-header">
          <div class="weather-main">
            <div class="weather-icon" role="img" aria-label="${this.getWeatherDescription(current.weather_code)}">${this.getWeatherIcon(current.weather_code)}</div>
            <div class="weather-temp-section">
              <div class="weather-temp" aria-label="Current temperature">${this.formatTemperature(current.temperature_2m)}</div>
              <div class="feels-like">Feels like ${this.formatTemperature(current.apparent_temperature)}</div>
            </div>
          </div>
          <div class="weather-description">${this.getWeatherDescription(current.weather_code)}</div>
          ${this.locationName ? `<div class="weather-location">📍 ${this.locationName}</div>` : ''}
        </div>
        
        <div class="weather-details" role="group" aria-label="Weather details">
          <div class="weather-detail">
            <div class="weather-detail-icon" aria-hidden="true">💧</div>
            <div class="weather-detail-label">Humidity</div>
            <div class="weather-detail-value">${current.relative_humidity_2m}%</div>
          </div>
          <div class="weather-detail">
            <div class="weather-detail-icon" aria-hidden="true">💨</div>
            <div class="weather-detail-label">Wind</div>
            <div class="weather-detail-value">${this.formatWindSpeed(current.wind_speed_10m)}</div>
          </div>
          <div class="weather-detail">
            <div class="weather-detail-icon" aria-hidden="true">☀️</div>
            <div class="weather-detail-label">UV Index</div>
            <div class="weather-detail-value">${current.uv_index || 0}</div>
          </div>
        </div>

        ${this.options.showHourly ? this.generateHourlyForecast(hourly) : ''}

        <div class="weather-forecast" role="group" aria-label="7-day forecast">
          <div class="forecast-header">
            <div class="forecast-title">7-Day Forecast</div>
            <div class="forecast-controls">
              <button class="forecast-nav prev" onclick="weatherWidget.scrollForecast(-1)" aria-label="Previous forecast days">‹</button>
              <button class="forecast-nav next" onclick="weatherWidget.scrollForecast(1)" aria-label="Next forecast days">›</button>
            </div>
          </div>
          <div class="forecast-container">
            <div class="forecast-days" id="forecast-scroll">
              ${this.generateExtendedForecast(daily)}
            </div>
          </div>
        </div>
        
        <div class="weather-controls" role="group" aria-label="Weather settings">
          <button class="temp-toggle" onclick="weatherWidget.toggleUnits()" aria-label="Toggle temperature units">
            Switch to ${this.options.units === 'metric' ? '°F' : '°C'}
          </button>
          <button class="settings-toggle" onclick="weatherWidget.toggleSettings()" aria-label="Open settings">
            ⚙️ Settings
          </button>
        </div>

        <div class="weather-settings" id="weather-settings" style="display: none;">
          <div class="settings-header">Settings</div>
          <div class="setting-item">
            <label for="forecast-days">Forecast Days:</label>
            <select id="forecast-days" onchange="weatherWidget.updateForecastDays(this.value)">
              <option value="3" ${this.options.forecastDays === 3 ? 'selected' : ''}>3 Days</option>
              <option value="5" ${this.options.forecastDays === 5 ? 'selected' : ''}>5 Days</option>
              <option value="7" ${this.options.forecastDays === 7 ? 'selected' : ''}>7 Days</option>
            </select>
          </div>
          <div class="setting-item">
            <label>
              <input type="checkbox" ${this.options.showHourly ? 'checked' : ''} onchange="weatherWidget.toggleHourly(this.checked)">
              Show Hourly Forecast
            </label>
          </div>
        </div>
      </div>
    `;
    
    // Update container with smooth transition
    this.container.innerHTML = weatherContent;
    
    // Store reference for global access
    window.weatherWidget = this;
    
    // Initialize forecast scroll position
    this.forecastScrollPosition = 0;
  }

  getWeatherIcon(code) {
    const weatherIcons = {
      0: '☀️',    // Clear sky
      1: '🌤️',   // Mainly clear
      2: '⛅',    // Partly cloudy
      3: '☁️',    // Overcast
      45: '🌫️',  // Fog
      48: '🌫️',  // Depositing rime fog
      51: '🌦️',  // Light drizzle
      53: '🌦️',  // Moderate drizzle
      55: '🌦️',  // Dense drizzle
      56: '🌨️',  // Light freezing drizzle
      57: '🌨️',  // Dense freezing drizzle
      61: '🌧️',  // Slight rain
      63: '🌧️',  // Moderate rain
      65: '🌧️',  // Heavy rain
      66: '🌨️',  // Light freezing rain
      67: '🌨️',  // Heavy freezing rain
      71: '❄️',   // Slight snow
      73: '❄️',   // Moderate snow
      75: '❄️',   // Heavy snow
      77: '🌨️',  // Snow grains
      80: '🌦️',  // Slight rain showers
      81: '🌦️',  // Moderate rain showers
      82: '�️',  // Violent rain showers
      85: '🌨️',  // Slight snow showers
      86: '🌨️',  // Heavy snow showers
      95: '⛈️',   // Thunderstorm
      96: '⛈️',   // Thunderstorm with slight hail
      99: '⛈️'    // Thunderstorm with heavy hail
    };
    
    return weatherIcons[code] || '🌤️';
  }

  getWeatherDescription(code) {
    const weatherDescriptions = {
      0: 'Clear sky',
      1: 'Mainly clear',
      2: 'Partly cloudy',
      3: 'Overcast',
      45: 'Fog',
      48: 'Depositing rime fog',
      51: 'Light drizzle',
      53: 'Moderate drizzle',
      55: 'Dense drizzle',
      56: 'Light freezing drizzle',
      57: 'Dense freezing drizzle',
      61: 'Slight rain',
      63: 'Moderate rain',
      65: 'Heavy rain',
      66: 'Light freezing rain',
      67: 'Heavy freezing rain',
      71: 'Slight snow',
      73: 'Moderate snow',
      75: 'Heavy snow',
      77: 'Snow grains',
      80: 'Slight rain showers',
      81: 'Moderate rain showers',
      82: 'Violent rain showers',
      85: 'Slight snow showers',
      86: 'Heavy snow showers',
      95: 'Thunderstorm',
      96: 'Thunderstorm with hail',
      99: 'Thunderstorm with heavy hail'
    };
    
    return weatherDescriptions[code] || 'Unknown weather';
  }

  formatTemperature(temp) {
    if (this.options.units === 'imperial') {
      const fahrenheit = (temp * 9/5) + 32;
      return `${Math.round(fahrenheit)}°F`;
    }
    return `${Math.round(temp)}°C`;
  }

  formatWindSpeed(speed) {
    if (this.options.units === 'imperial') {
      const mph = speed * 0.621371;
      return `${Math.round(mph)} mph`;
    }
    return `${Math.round(speed)} km/h`;
  }

  generateForecast(daily) {
    const days = ['Today', 'Tomorrow', 'Day 3'];
    let forecastHTML = '';
    
    for (let i = 0; i < 3; i++) {
      const maxTemp = this.formatTemperature(daily.temperature_2m_max[i]);
      const minTemp = this.formatTemperature(daily.temperature_2m_min[i]);
      const icon = this.getWeatherIcon(daily.weather_code[i]);
      const precipitation = daily.precipitation_sum[i] || 0;
      
      forecastHTML += `
        <div class="forecast-day">
          <div class="forecast-day-name">${days[i]}</div>
          <div class="forecast-icon">${icon}</div>
          <div class="forecast-temps">
            <span class="forecast-high">${maxTemp}</span>
            <span class="forecast-low">${minTemp}</span>
          </div>
          ${precipitation > 0 ? `<div class="forecast-rain">�️ ${precipitation}mm</div>` : ''}
        </div>
      `;
    }
    
    return forecastHTML;
  }

  generateExtendedForecast(daily) {
    const days = ['Today', 'Tomorrow', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const today = new Date();
    let forecastHTML = '';
    
    for (let i = 0; i < this.options.forecastDays; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      const dayName = i < 2 ? days[i] : days[date.getDay()];
      const maxTemp = this.formatTemperature(daily.temperature_2m_max[i]);
      const minTemp = this.formatTemperature(daily.temperature_2m_min[i]);
      const icon = this.getWeatherIcon(daily.weather_code[i]);
      const precipitation = daily.precipitation_sum[i] || 0;
      const uvIndex = daily.uv_index_max[i] || 0;
      const windSpeed = this.formatWindSpeed(daily.wind_speed_10m_max[i] || 0);
      
      forecastHTML += `
        <div class="forecast-day" role="group" aria-label="${dayName} forecast">
          <div class="forecast-day-name">${dayName}</div>
          <div class="forecast-date">${date.getDate()}/${date.getMonth() + 1}</div>
          <div class="forecast-icon" role="img" aria-label="${this.getWeatherDescription(daily.weather_code[i])}">${icon}</div>
          <div class="forecast-temps">
            <span class="forecast-high" aria-label="High temperature">${maxTemp}</span>
            <span class="forecast-low" aria-label="Low temperature">${minTemp}</span>
          </div>
          <div class="forecast-details">
            ${precipitation > 0 ? `<div class="forecast-rain" title="Precipitation">🌧️ ${precipitation}mm</div>` : ''}
            ${uvIndex > 5 ? `<div class="forecast-uv" title="UV Index">☀️ ${uvIndex}</div>` : ''}
            <div class="forecast-wind" title="Wind speed">💨 ${windSpeed}</div>
          </div>
        </div>
      `;
    }
    
    return forecastHTML;
  }

  generateHourlyForecast(hourly) {
    if (!hourly) return '';
    
    const now = new Date();
    let hourlyHTML = `
      <div class="hourly-forecast" role="group" aria-label="24-hour forecast">
        <div class="hourly-title">Next 24 Hours</div>
        <div class="hourly-container">
          <div class="hourly-scroll" id="hourly-scroll">
    `;
    
    for (let i = 0; i < 24; i++) {
      const hour = new Date(now.getTime() + (i * 60 * 60 * 1000));
      const temp = this.formatTemperature(hourly.temperature_2m[i]);
      const icon = this.getWeatherIcon(hourly.weather_code[i]);
      const precipitation = hourly.precipitation_probability[i] || 0;
      
      hourlyHTML += `
        <div class="hourly-item">
          <div class="hourly-time">${hour.getHours()}:00</div>
          <div class="hourly-icon">${icon}</div>
          <div class="hourly-temp">${temp}</div>
          ${precipitation > 0 ? `<div class="hourly-rain">${precipitation}%</div>` : '<div class="hourly-rain"></div>'}
        </div>
      `;
    }
    
    hourlyHTML += `
          </div>
        </div>
      </div>
    `;
    
    return hourlyHTML;
  }

  checkWeatherAlerts(current, daily) {
    const alerts = [];
    
    // High UV Alert
    if (current.uv_index && current.uv_index > 7) {
      alerts.push({
        type: 'uv',
        message: 'High UV Index - Sun protection recommended',
        icon: '☀️'
      });
    }
    
    // High Wind Alert
    if (current.wind_speed_10m > 40) {
      alerts.push({
        type: 'wind',
        message: 'High wind speeds - Exercise caution outdoors',
        icon: '💨'
      });
    }
    
    // Heavy Rain Alert
    if (current.precipitation > 10) {
      alerts.push({
        type: 'rain',
        message: 'Heavy rainfall - Consider indoor activities',
        icon: '🌧️'
      });
    }
    
    if (alerts.length === 0) return '';
    
    return `
      <div class="weather-alerts" role="alert" aria-live="polite">
        ${alerts.map(alert => `
          <div class="weather-alert ${alert.type}">
            <span class="alert-icon">${alert.icon}</span>
            <span class="alert-message">${alert.message}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  scrollForecast(direction) {
    const container = document.getElementById('forecast-scroll');
    if (container) {
      const scrollAmount = 200;
      this.forecastScrollPosition += direction * scrollAmount;
      this.forecastScrollPosition = Math.max(0, this.forecastScrollPosition);
      container.scrollTo({
        left: this.forecastScrollPosition,
        behavior: 'smooth'
      });
    }
  }

  toggleSettings() {
    const settings = document.getElementById('weather-settings');
    if (settings) {
      settings.style.display = settings.style.display === 'none' ? 'block' : 'none';
    }
  }

  updateForecastDays(days) {
    this.options.forecastDays = parseInt(days);
    this.fetchWeatherData();
  }

  toggleHourly(show) {
    this.options.showHourly = show;
    this.fetchWeatherData();
  }

  setupAccessibility() {
    // Add keyboard navigation
    this.container.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') {
        this.scrollForecast(-1);
      } else if (e.key === 'ArrowRight') {
        this.scrollForecast(1);
      }
    });
  }

  // Clean up method
  destroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }
}

// Initialize weather widget when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new WeatherWidget('weather-widget');
});
