"""Original offline cloud textures: integrate a lit 3D density field into transparent pixels."""
from pathlib import Path
import numpy as np
from PIL import Image
W,H=512,256
X,Y=np.meshgrid(np.linspace(-2,2,W,dtype=np.float32),np.linspace(1,-1,H,dtype=np.float32))
base=[(-1.1,-.13,.05,.40,.30,.35),(-.62,.10,-.1,.53,.48,.47),(-.12,.30,.02,.51,.54,.51),(.42,.13,-.06,.59,.47,.48),(.97,-.09,.06,.45,.29,.36),(0,-.22,.03,1.22,.25,.44)]
for seed in range(3):
 rng=np.random.default_rng(72+seed)
 lobes=[(cx+rng.uniform(-.08,.08),cy+rng.uniform(-.05,.05),cz+rng.uniform(-.10,.10),sx*rng.uniform(.93,1.1),sy*rng.uniform(.93,1.1),sz) for cx,cy,cz,sx,sy,sz in base]
 def density(x,y,z):
  d=np.zeros_like(x,dtype=np.float32)
  for cx,cy,cz,sx,sy,sz in lobes:d+=np.exp(-(((x-cx)/sx)**2+((y-cy)/sy)**2+((z-cz)/sz)**2)*1.65)
  noise=.075*np.sin(x*14+z*8+seed)*np.sin(y*18-z*6)+.026*np.sin(x*37+y*29+z*19)
  return np.maximum(0,d-.11+noise)*2.5
 trans=np.ones((H,W),np.float32);color=np.zeros((H,W,3),np.float32)
 step=2.8/42
 for z in np.linspace(1.4,-1.4,42):
  d=density(X,Y,z);optical=np.zeros_like(d)
  for k in range(1,7):
   distance=k*.18
   optical+=density(X-.52*distance,Y+.73*distance,z+.46*distance)*.18
  lit=np.exp(-optical*1.25)
  rgb=np.empty((H,W,3),np.float32)
  for channel,(shadow,light) in enumerate(zip([.48,.59,.68],[.99,.99,.96])):rgb[:,:,channel]=shadow+(light-shadow)*lit
  alpha=1-np.exp(-d*step*1.7)
  color+=trans[:,:,None]*alpha[:,:,None]*rgb
  trans*=1-alpha
 alpha=1-trans
 color=np.divide(color,alpha[:,:,None],out=np.ones_like(color),where=alpha[:,:,None]>.0001)
 image=np.concatenate((np.clip(color,0,1),alpha[:,:,None]),axis=2)
 path=Path(__file__).resolve().parents[1]/'assets'/f'cloud-volume-{seed+1}.webp'
 Image.fromarray(np.uint8(np.clip(image*255,0,255)),'RGBA').save(path,'WEBP',quality=93,method=6)
 print(path,path.stat().st_size)
