import sys
from mcgen.house import build_house
from mcgen.proportions import solve
from mcgen.check import leaks
tot=0; bad=[]
for pal,W,D,F,pitch in (("medieval_timber",15,9,2,"normal"),("medieval_timber",13,9,2,"steep"),("oak_cottage",17,9,2,"low"),("taiga_cabin",11,9,1,"normal"),("medieval_timber",15,11,1,"normal")):
    base,_,_=solve({"palette":pal,"width":W,"depth":D,"floors":F,"floor_height":4 if F>1 else 5,"jetty":F>1,"roof_pitch":pitch,"seed":1})
    for plan in ("rect","L","T","H","cross","cross_long","longhouse"):
        for sd in range(1,6):
            S=build_house({**base,"plan":plan,"seed":sd,"annexes":[]})
            if hasattr(S,"layout") and "volumes" in S.layout:
                rooms=[(r[0],r[1],r[2],r[3],1,f*fh) for _,r,_,f,fh in S.layout["volumes"]]
            else:
                rooms=[(0,base["width"]-1,0,base["depth"]-1,1,base["floors"]*base["floor_height"])]
            h=leaks(S,rooms); tot+=1
            if h: bad.append((pal,pitch,plan,sd,len(h),sorted(h)[:4]))
print("cases",tot,"leaky",len(bad))
for b in bad[:25]: print(b)

# annex scan: closed rooms only (open-front annexes leak by design)
bad=[]; tot=0
for pal,W,D,F in (("medieval_timber",15,9,2),("oak_cottage",17,9,2),("taiga_cabin",11,9,1)):
    base,_,_=solve({"palette":pal,"width":W,"depth":D,"floors":F,"floor_height":4 if F>1 else 5,"jetty":F>1,"roof_pitch":"normal","seed":1})
    for func in ("dwelling","smithy","farm","tavern"):
        for plan in ("rect","L","T","H","cross_long","longhouse"):
            for sd in range(1,4):
                S=build_house({**base,"plan":plan,"function":func,"seed":sd}); tot+=1
                lay=getattr(S,"layout",None)
                if not lay or "volumes" not in lay: continue
                rooms=[(r[0],r[1],r[2],r[3],1,f*fh) for k,r,_,f,fh in lay["volumes"] if k not in ("smithy","stable","woodshed")]
                h=leaks(S,rooms)
                if h: bad.append((pal,func,plan,sd,lay["annexes"],sorted(h)[:4]))
print("annex cases",tot,"leaky",len(bad))
for b in bad[:20]: print(b)
