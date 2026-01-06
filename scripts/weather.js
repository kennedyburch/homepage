// Weather Widget Implementation
class WeatherWidget {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.options = {
      refreshInterval: 600000, // 10 minutes
      units: 'metric', // 'metric' or 'imperial'
      showForecast: true,
      ...options
    };
    
    if (!this.container) {
      console.error('Weather widget container not found');
      return;
    }
    
    this.locationName = null;
    this.init();
  }

  async init() {
    try {
      this.showLoading();
      await this.getUserLocation();
      await this.fetchWeather();
      this.setupAutoRefresh();
    } catch (error) {
      this.showError('Failed to load weather data');
      console.error('Weather widget initialization error:', error);
    }
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

  async fetchWeather() {
    try {
      const baseUrl = 'https://api.open-meteo.com/v1/forecast';
      const params = new URLSearchParams({
        latitude: this.latitude,
        longitude: this.longitude,
        current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,apparent_temperature,precipitation',
        daily: 'temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum',
        timezone: 'auto',
        forecast_days: 3
      });
      
      const url = `${baseUrl}?${params}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`);
      }
      
      const data = await response.json();
      this.displayWeather(data);
      
    } catch (error) {
      console.error('Failed to fetch weather:', error);
      this.showError('Unable to load weather data. Please check your connection.');
    }
  }

  displayWeather(data) {
    const { current, daily } = data;
    
    // Create weather content HTML
    const weatherContent = `
      <div class="weather-content loaded">
        <div class="weather-header">
          <div class="weather-main">
            <div class="weather-icon">${this.getWeatherIcon(current.weather_code)}</div>
            <div class="weather-temp-section">
              <div class="weather-temp">${this.formatTemperature(current.temperature_2m)}</div>
              <div class="feels-like">Feels like ${this.formatTemperature(current.apparent_temperature)}</div>
            </div>
          </div>
          <div class="weather-description">${this.getWeatherDescription(current.weather_code)}</div>
          ${this.locationName ? `<div class="weather-location">📍 ${this.locationName}</div>` : ''}
        </div>
        
        <div class="weather-details">
          <div class="weather-detail">
            <div class="weather-detail-icon">💧</div>
            <div class="weather-detail-label">Humidity</div>
            <div class="weather-detail-value">${current.relative_humidity_2m}%</div>
          </div>
          <div class="weather-detail">
            <div class="weather-detail-icon">💨</div>
            <div class="weather-detail-label">Wind</div>
            <div class="weather-detail-value">${this.formatWindSpeed(current.wind_speed_10m)}</div>
          </div>
          <div class="weather-detail">
            <div class="weather-detail-icon">🌧️</div>
            <div class="weather-detail-label">Rain</div>
            <div class="weather-detail-value">${current.precipitation || 0}mm</div>
          </div>
        </div>

        <div class="weather-forecast">
          <div class="forecast-title">3-Day Forecast</div>
          <div class="forecast-days">
            ${this.generateForecast(daily)}
          </div>
        </div>
        
        <div class="weather-controls">
          <button class="temp-toggle" onclick="weatherWidget.toggleUnits()">
            Switch to ${this.options.units === 'metric' ? '°F' : '°C'}
          </button>
        </div>
      </div>
    `;
    
    // Update container with smooth transition
    this.container.innerHTML = weatherContent;
    
    // Store reference for global access
    window.weatherWidget = this;
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

  toggleUnits() {
    this.options.units = this.options.units === 'metric' ? 'imperial' : 'metric';
    this.fetchWeather(); // Refresh display with new units
  }

  showError(message) {
    this.container.innerHTML = `
      <div class="weather-error show">
        <div class="error-icon">⚠️</div>
        <div class="error-message">${message}</div>
        <button class="retry-button" onclick="weatherWidget.init()">Try Again</button>
      </div>
    `;
  }

  setupAutoRefresh() {
    // Clear any existing interval
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    
    this.refreshInterval = setInterval(() => {
      console.log('Auto-refreshing weather data...');
      this.fetchWeather();
    }, this.options.refreshInterval);
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
