"""Generate four ORIGINAL, royalty-free, loopable ambient soundscapes for ThinTreé.
This is source-only generation; it does not download or reproduce commercial songs.
"""
from pathlib import Path
import math
import wave
import numpy as np

SR=16000
DURATION=20.0
N=int(SR*DURATION)
OUT=Path(__file__).resolve().parent.parent/'public'/'audio'
OUT.mkdir(parents=True,exist_ok=True)

def hz(midi): return 440*2**((midi-69)/12)

def voice(midi,seconds,timbre='bell'):
    t=np.arange(int(seconds*SR))/SR
    f=hz(midi)
    if timbre=='pad':
        signal=(np.sin(2*np.pi*f*t)+.26*np.sin(2*np.pi*(f*2)*t)+.12*np.sin(2*np.pi*(f*3)*t))
        amp=np.minimum(1,t/.55)*np.minimum(1,(seconds-t)/.6)
        return signal*amp*.18
    if timbre=='bell':
        signal=np.sin(2*np.pi*f*t)+.23*np.sin(2*np.pi*f*2.01*t)+.12*np.sin(2*np.pi*f*3.93*t)
        amp=np.exp(-t*1.45)*np.minimum(1,t/.008)
        return signal*amp*.13
    signal=(np.sin(2*np.pi*f*t)+.18*np.sin(2*np.pi*f*2*t))
    return signal*np.exp(-t*.8)*.16

def add(samples,start,sound):
    ix=round(start*SR)
    if ix>=len(samples):return
    size=min(len(sound),len(samples)-ix)
    samples[ix:ix+size]+=sound[:size]

pieces={
 'intro': {'chords':[[60,64,67,71],[57,60,64,67],[53,57,60,64],[55,59,62,67]], 'melody':[72,76,79,76,74,72,71,67,69,72,76,72,74,71,67,64]},
 'family': {'chords':[[62,66,69,73],[59,62,66,69],[55,59,62,66],[57,61,64,69]], 'melody':[74,78,81,78,76,74,73,69,71,74,78,74,76,73,69,66]},
 'school': {'chords':[[52,55,59,64],[48,52,55,59],[55,59,62,67],[50,54,57,62]], 'melody':[76,74,72,71,67,69,71,72,74,76,79,76,74,71,69,67]},
 'university': {'chords':[[57,60,64,69],[53,57,60,65],[50,53,57,62],[52,56,59,64]], 'melody':[81,84,83,79,76,79,81,76,77,81,84,81,80,76,83,81]}
}

for name,piece in pieces.items():
    samples=np.zeros(N,dtype=np.float64)
    for j,chord in enumerate(piece['chords']):
        t=j*5
        for m in chord:
            add(samples,t,voice(m-12,5.6,'pad'))
            if name!='university':add(samples,t,voice(m,4.5,'pad')*.25)
        add(samples,t,voice(chord[0]-24,4.3,'pad')*.7)
    for i,note in enumerate(piece['melody']):
        if (name=='family' and i%4==3):continue
        if (name=='school' and i%2==1):continue
        add(samples,i*1.25,voice(note,2.2,'bell' if name!='school' else 'piano'))
    # a simple delay produces a gentle, expansive echo with no 3rd party assets
    delay=int((.29 if name=='university' else .43)*SR)
    echo=samples.copy()
    samples[delay:]+=echo[:-delay]*.24
    if name=='university':
        # a very quiet upper-octave shimmer for the celestial chapter
        for i in [0,5,10,15]: add(samples,i*1.25+.63,voice(piece['melody'][i]+12,2,'bell')*.32)
    # crossfade the tail into the start so browser loop sounds continuous
    fade=int(SR*.45)
    samples[:fade]=samples[:fade]*np.linspace(0,1,fade)+samples[-fade:]*np.linspace(1,0,fade)
    samples[-fade:]*=np.linspace(1,0,fade)
    samples=np.tanh(samples*1.3)*.71
    pcm=(samples*32767).astype('<i2')
    with wave.open(str(OUT/f'{name}.wav'),'wb') as wf:
        wf.setnchannels(1);wf.setsampwidth(2);wf.setframerate(SR);wf.writeframes(pcm.tobytes())
    print(name,len(pcm)/SR,'seconds')
