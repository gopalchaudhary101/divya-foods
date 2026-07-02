module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ocean: {
          900: '#042C53',
          700: '#0C447C',
          500: '#185FA5',
          300: '#85B7EB',
          100: '#B5D4F4',
          50: '#E6F1FB'
        },
        gold: {
          600: '#BA7517',
          500: '#EF9F27',
          400: '#FAC775',
          100: '#FAEEDA'
        },
        mint: {
          600: '#0F6E56',
          400: '#5DCAA5',
          100: '#9FE1CB'
        },
        cream: '#FAEEDA',
        ink: '#042C53'
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        premium: '0 10px 40px -10px rgba(4, 44, 83, 0.25)',
        glass: '0 8px 32px 0 rgba(4, 44, 83, 0.15)'
      },
      backgroundImage: {
        'ocean-gradient': 'linear-gradient(135deg, #042C53 0%, #0C447C 55%, #185FA5 100%)',
        'gold-gradient': 'linear-gradient(135deg, #EF9F27 0%, #FAC775 100%)'
      },
      animation: {
        float: 'float 4s ease-in-out infinite',
        'float-delayed': 'float 4s ease-in-out 1.5s infinite',
        wave: 'wave 8s linear infinite',
        bubble: 'bubble linear infinite'
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' }
        },
        wave: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' }
        },
        bubble: {
          '0%': { transform: 'translateY(0) scale(0.8)', opacity: '0' },
          '10%': { opacity: '0.6' },
          '100%': { transform: 'translateY(-400px) scale(1.1)', opacity: '0' }
        }
      }
    }
  },
  plugins: []
}
