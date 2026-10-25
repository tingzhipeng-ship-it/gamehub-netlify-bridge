# GameHub download: DODGE. Supports both SH1106 and ILI9341 logical 128x64.
# Install gh_dodge.py into ESP32 root next to main.py, then press EN.
import time
import random

def run(screen, get_key, end_screen):
    player = 57
    rock = random.randrange(2, 121)
    y = 12
    score = 0
    last = time.ticks_ms()
    while True:
        key = get_key()
        if key in ('B', 'START'):
            return
        if key == 'LEFT':
            player = max(0, player - 8)
        elif key == 'RIGHT':
            player = min(115, player + 8)
        now = time.ticks_ms()
        if time.ticks_diff(now, last) >= max(55, 165 - score * 3):
            last = now
            y += 3
            hit = y >= 55 and y <= 63 and rock < player + 13 and rock + 7 > player
            if hit:
                screen.fill(0)
                screen.text('DODGE GAME OVER', 0, 12)
                screen.text('Score: %d' % score, 0, 29)
                screen.text('A/B: MENU', 0, 46)
                screen.show()
                end_screen()
                return
            if y >= 64:
                score += 1
                rock = random.randrange(2, 121)
                y = 12
            screen.fill(0)
            screen.text('DODGE  %d' % score, 0, 1)
            screen.hline(0, 11, 128, 1)
            screen.fill_rect(rock, y, 7, 6, 1)
            screen.fill_rect(player, 60, 13, 4, 1)
            screen.show()
        time.sleep_ms(15)
