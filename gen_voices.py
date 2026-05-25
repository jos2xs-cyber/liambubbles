import asyncio
import edge_tts
import os

WORDS = {
    'amazing_spider_kid':  'Amazing Spider Kid',
    'wow_you_are_good':    'Wow, you are good!',
    'pirates_booty':       'Pirates Booty',
    'lightning_boy':       'Lightning Boy',
    'crazy_cool':          'Crazy Cool',
    'epic_tacos':          'Epic Tacos',
    'super_stinky':        'Super Stinky',
    'spicy_bananas':       'Spicy Bananas',
    'turbo_pants':         'Turbo Pants',
    'cosmic_waffles':      'Cosmic Waffles',
    'boom_shakalaka':      'Boom Shakalaka',
    'captain_noodles':     'Captain Noodles',
    'rocket_monkey':       'Rocket Monkey',
    'laser_toes':          'Laser Toes',
    'taco_thunder':        'Taco Thunder',
    'flying_underpants':   'Flying Underpants',
    'pickle_explosion':    'Pickle Explosion',
    'sneaky_pancakes':     'Sneaky Pancakes',
    'monster_muffins':     'Monster Muffins',
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
