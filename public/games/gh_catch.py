# GameHub download: CATCH. Supports both SH1106 and ILI9341 logical 128x64.
# Install gh_catch.py into ESP32 root next to main.py, then press EN.
import time
import random

def run(screen, get_key, end_screen):
    paddle = 55
    x = random.randrange(3, 123)
    y = 12
    score = 0
    missed = 0
    last = time.ticks_ms()
    while True:
        key = get_key()
        if key in ('B', 'START'):
            return
        if key == 'LEFT':
            paddle = max(0, paddle - 8)
        elif key == 'RIGHT':
            paddle = min(108, paddle + 8)
        now = time.ticks_ms()
        if time.ticks_diff(now, last) >= max(65, 175 - score * 3):
            last = now
            y += 3
            if y >= 57:
                if paddle <= x <= paddle + 20:
                    score += 1
                else:
                    missed += 1
                x = random.randrange(3, 123)
                y = 12
            screen.fill(0)
            screen.text('CATCH  %d/5' % missed, 0, 1)
            screen.hline(0, 11, 128, 1)
            screen.fill_rect(x, y, 3, 3, 1)
            screen.fill_rect(paddle, 60, 20, 3, 1)
            screen.show()
            if missed >= 5:
                screen.fill(0)
                screen.text('CATCH FINISHED', 0, 12)
                screen.text('Score: %d' % score, 0, 29)
                screen.text('A/B: MENU', 0, 46)
                screen.show()
                end_screen()
                return
        time.sleep_ms(15)
