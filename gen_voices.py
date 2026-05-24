import asyncio
import edge_tts
import os

WORDS = {
    'amazing_spider_kid': 'Amazing Spider Kid',
    'wow_you_are_good':   'Wow, you are good!',
    'pirates_booty':      'Pirates Booty',
    'lightning_boy':      'Lightning Boy',
    'crazy_cool':         'Crazy Cool',
    'epic_tacos':         'Epic Tacos',
    'super_stinky':       'Super Stinky',
    'spicy_bananas':      'Spicy Bananas',
}
VOICE = "en-GB-RyanNeural"  # British male, energetic
OUT = "public/sounds/voice"
os.makedirs(OUT, exist_ok=True)

async def generate():
    for filename, text in WORDS.items():
        communicate = edge_tts.Communicate(
            text,
            VOICE,
            rate="-5%",     # near-normal speed = punchy
            pitch="+8Hz"    # higher = brighter/happier
        )
        path = f"{OUT}/{filename}.mp3"
        await communicate.save(path)
        print(f"Generated {path}")

asyncio.run(generate())
print("Done!")
