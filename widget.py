import tkinter as tk
import requests

# Настройки
POLL_INTERVAL_MS = 3000  # 3 секунды (Безопасно для лимита в 45 зап/мин)
API_URL = "http://ip-api.com/json/"

class IPWidget:
    def __init__(self, root):
        self.root = root

        # Задаем темный фон в стиле Windows 11
        self.root.configure(bg='#202020')

        # Переменные для хранения текста
        self.country_var = tk.StringVar(value="Country: Loading...")
        self.geo_var = tk.StringVar(value="Geo: Loading...")

        # Настройка шрифтов (Segoe UI — системный шрифт Windows)
        font_style = ("Segoe UI", 11, "bold")

        # Создаем текстовые метки
        tk.Label(self.root, textvariable=self.country_var, bg='#202020', fg='#4DAAFE', font=font_style).pack(pady=(10, 2), padx=15, anchor='w')
        tk.Label(self.root, textvariable=self.geo_var, bg='#202020', fg='#E0E0E0', font=font_style).pack(pady=(2, 10), padx=15, anchor='w')

        # Закрытие виджета по клику ПРАВОЙ кнопкой мыши
        self.root.bind("<Button-3>", lambda e: self.root.quit())

        # Запускаем первый опрос
        self.update_data()

    def update_data(self):
        try:
            # Делаем запрос к API
            response = requests.get(API_URL, timeout=2)
            data = response.json()

            if data.get("status") == "success":
                self.country_var.set(f"Country: {data.get('country', 'N/A')}")
                city = data.get('city', 'N/A')
                ip_addr = data.get('query', 'N/A')
                self.geo_var.set(f"Geo: {city} ({ip_addr})")
            else:
                self.country_var.set("Country: Rate Limit!")
                self.geo_var.set("Geo: Waiting...")

        except requests.exceptions.RequestException:
            self.country_var.set("Country: Offline")
            self.geo_var.set("Geo: Check Network")

        # Планируем следующий запуск через 3 секунды
        self.root.after(POLL_INTERVAL_MS, self.update_data)

if __name__ == "__main__":
    root = tk.Tk()

    # Временно скрываем окно до того, как установим правильную позицию
    root.withdraw()

    app = IPWidget(root)

    # Заставляем систему просчитать все элементы интерфейса
    root.update_idletasks()

    # --- Настройка позиционирования ---
    screen_width = root.winfo_screenwidth()
    screen_height = root.winfo_screenheight()

    # Задаем размеры нашего виджета
    widget_width = 250
    widget_height = 80

    # Примерная высота панели задач Windows 11 + отступ
    taskbar_height = 55
    margin_right = 15

    # Вычисляем координаты для правого нижнего угла
    x = screen_width - widget_width - margin_right
    y = screen_height - widget_height - taskbar_height

    # Применяем размеры и координаты
    root.geometry(f"{widget_width}x{widget_height}+{x}+{y}")

    # Фиксируем поверх всех окон
    root.attributes('-topmost', True)

    # Показываем окно обратно
    root.deiconify()

    # Безопасное отключение системных рамок для Windows 11 (выполняется с микрозадержкой)
    root.after(10, lambda: root.overrideredirect(True))

    root.mainloop()