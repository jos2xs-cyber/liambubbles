import numpy as np, wave, os

SR = 44100
OUT = "public/sounds"
os.makedirs(OUT, exist_ok=True)

def write_wav(path, samples):
    samples = np.clip(samples, -1.0, 1.0)
    peak = np.max(np.abs(samples))
    if peak > 0.001: samples = samples / peak * 0.88
    pcm = (samples * 32767).astype(np.int16)
    with wave.open(path, 'w') as f:
        f.setnchannels(1); f.setsampwidth(2); f.setframerate(SR)
        f.writeframes(pcm.tobytes())

rng = np.random.default_rng(42)

# pop.wav
N = int(SR*0.18); tt = np.arange(N)/SR
freqs = 900*np.exp(tt*np.log(40/900)/0.18)
phase = np.cumsum(freqs)*2*np.pi/SR
pop = np.sin(phase)*np.exp(-tt/0.025)*0.6 + rng.uniform(-1,1,N)*np.exp(-tt/0.006)*0.3 + np.sin(2*np.pi*60*tt)*np.exp(-tt/0.04)*0.3
delay_n = int(0.03*SR); rev = np.zeros(N); rev[delay_n:] = pop[:-delay_n]*0.15
write_wav(f"{OUT}/pop.wav", pop+rev)

# connect.wav
N = int(SR*0.14); tt = np.arange(N)/SR; freq=1046.50
env = np.exp(-tt/0.035)*np.minimum(tt/0.003,1.0)
write_wav(f"{OUT}/connect.wav", (np.sin(2*np.pi*freq*tt)*0.6+np.sin(2*np.pi*freq*2*tt)*0.25+np.sin(2*np.pi*freq*3*tt)*0.1)*env)

# power_up.wav
N = int(SR*0.55); tt = np.arange(N)/SR
layers = []
for i,freq in enumerate([523.25,659.25,783.99,1046.50]):
    d=i*0.022; local_t=np.maximum(tt-d,0); env=np.minimum(local_t/0.04,1.0)*np.exp(-local_t/0.22); env[:int(d*SR)]=0
    layers.append((np.sin(2*np.pi*freq*tt)*0.6+np.sin(2*np.pi*freq*2*tt)*0.2)*env*0.35)
write_wav(f"{OUT}/power_up.wav", np.sum(layers,axis=0))

# epic_pop.wav
N = int(SR*0.75); tt = np.arange(N)/SR; layers=[]
for i,freq in enumerate([523.25,587.33,659.25,783.99,1046.50]):
    d=i*0.042; local_t=np.maximum(tt-d,0); env=np.minimum(local_t/0.008,1.0)*np.exp(-local_t/0.18); env[:int(d*SR)]=0
    layers.append((np.sin(2*np.pi*freq*tt)*0.55+np.sin(2*np.pi*freq*2*tt)*0.28+np.sin(2*np.pi*freq*3*tt)*0.12)*env*0.35)
layers.append(rng.uniform(-1,1,N)*np.exp(-tt/0.005)*0.2)
write_wav(f"{OUT}/epic_pop.wav", np.sum(layers,axis=0))

# legendary_pop.wav
N = int(SR*1.3); tt = np.arange(N)/SR; layers=[]
bass_f=65*np.exp(-tt/0.3)+38; bp=np.cumsum(bass_f)*2*np.pi/SR; benv=np.exp(-tt/0.28)*np.minimum(tt/0.005,1.0)
layers.append(np.sin(bp)*benv*0.85+np.sin(bp*2)*benv*0.25)
for i,freq in enumerate([523.25,659.25,783.99,880.0,1046.50]):
    d=i*0.085; local_t=np.maximum(tt-d,0); env=np.minimum(local_t/0.025,1.0)*np.exp(-local_t/0.38); env[:int(d*SR)]=0
    layers.append((np.sin(2*np.pi*freq*tt)*0.6+np.sin(2*np.pi*freq*2*tt)*0.22)*env*0.32)
sN=int(0.45*SR); sw_t=tt[:sN]; sw_f=200*np.exp(sw_t*np.log(10)/0.45)
sw_p=np.cumsum(sw_f)*2*np.pi/SR; sw_env=np.exp(-sw_t/0.18)*np.minimum(sw_t/0.01,1.0)
sweep=np.zeros(N); sweep[:sN]=np.sin(sw_p)*sw_env*0.3; layers.append(sweep)
write_wav(f"{OUT}/legendary_pop.wav", np.sum(layers,axis=0))

# refill.wav
N = int(SR*0.30); tt = np.arange(N)/SR
ref_f=80*np.exp(tt*np.log(500/80)/0.30); ref_p=np.cumsum(ref_f)*2*np.pi/SR
env=np.minimum(tt/0.01,1.0)*np.exp(-tt/0.12)
write_wav(f"{OUT}/refill.wav", (np.sin(ref_p)*0.65+np.sin(ref_p*2)*0.2+rng.uniform(-1,1,N)*0.12)*env)

# clapping.wav — 7 sharp claps with crowd-like layering
N = int(SR * 2.0)
result = np.zeros(N)
clap_times = [0.0, 0.22, 0.44, 0.66, 0.88, 1.10, 1.32]
for ct in clap_times:
    start = int(ct * SR)
    clap_len = int(0.07 * SR)
    if start + clap_len > N: break
    noise = rng.uniform(-1, 1, clap_len)
    env = np.exp(-np.arange(clap_len) / (clap_len * 0.18))
    env[:int(clap_len * 0.015)] = np.linspace(0, 1, int(clap_len * 0.015))
    result[start:start + clap_len] += noise * env * 0.75
    # add slight reverb tail
    tail_start = start + int(0.04 * SR)
    tail_len = int(0.12 * SR)
    if tail_start + tail_len <= N:
        tail_noise = rng.uniform(-1, 1, tail_len)
        tail_env = np.exp(-np.arange(tail_len) / (tail_len * 0.4))
        result[tail_start:tail_start + tail_len] += tail_noise * tail_env * 0.18
write_wav(f"{OUT}/clapping.wav", result)

# fart.wav — classic "brrrt" with flutter amplitude modulation
N = int(SR * 0.85)
tt = np.arange(N) / SR

# Very low base freq, slight downward pitch drift
freq = 75 * np.exp(-tt / 0.5) + 42
freq += 18 * np.sin(2 * np.pi * 9 * tt) * np.exp(-tt / 0.3)  # 9Hz wobble
phase = np.cumsum(freq) * 2 * np.pi / SR

# Rich harmonics — lots of odd harmonics = wet fleshy sound
carrier = (np.sin(phase) * 0.50 +
           np.sin(2 * phase) * 0.28 +
           np.sin(3 * phase) * 0.14 +
           np.sin(5 * phase) * 0.07 +
           np.sin(7 * phase) * 0.04)

# Flutter modulation at ~28Hz — this is what makes it "brrrt" not "whoosh"
flutter = np.abs(np.sin(2 * np.pi * 28 * tt)) ** 0.4

# Wet noise layer
noise = rng.uniform(-1, 1, N) * 0.20

# Overall envelope: instant attack, medium decay
env = np.exp(-tt / 0.30) * np.minimum(tt / 0.004, 1.0)

# Splat transient at the very start
splat_len = int(0.03 * SR)
splat = rng.uniform(-1, 1, splat_len) * np.exp(-np.arange(splat_len) / (splat_len * 0.15))

fart = (carrier + noise) * env * flutter
fart[:splat_len] += splat * 0.5
write_wav(f"{OUT}/fart.wav", fart)

print("Done — 8 WAV files written to public/sounds/")
