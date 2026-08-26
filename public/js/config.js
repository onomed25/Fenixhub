
        tailwind.config = {
            theme: {
                extend: {
                    fontFamily: { 
                        sans: ['Outfit', 'sans-serif'],
                        display: ['Clash Display', 'sans-serif']
                    },
                    colors: {
                        bg: '#05070D',
                        surface: '#111827',
                        text: '#FFF8F0',
                        'text-soft': '#D7DEE9',
                        primary: '#FF6A00',
                        'primary-hover': '#FF8126',
                        highlight: '#FFB020',
                        danger: '#E83D1C',
                        'on-accent': '#111827',
                        // Mapeando as cores antigas para a nova paleta para manter a compatibilidade
                        obsidian: { 800: '#111827', 900: '#111827', 950: '#05070D' },
                        ember: { 400: '#FFB020', 500: '#FF6A00', 600: '#FF8126' },
                        zinc: { 850: '#111827', 900: '#111827', 950: '#05070D' }
                    }
                }
            }
        }
    