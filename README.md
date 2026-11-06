### Dynamical Friction

3D Sim of Dynamical Friction (`friction_Chandrasekhar`)
- 1 main star moving rightward (+x)
- 20 x 20 x 20 grid of initially motionless stars
- Classic gravity: a = G * M / r^2 (step with Velocity Verlet)

---
### How dynamical friction works
1. The moving star travels, and along the way, attracts stars.
2. As the stars get near, the moving star moves ahead, so behind the moving star is a dense wake.
3. The concentration pulls (-x) on the moving star more than the stars in front pull on the moving star.

Also

4. Some stars are slingshot away. They gain kinetic exergy, and the main star loses exergy.


---
### Why?
- Interesting inevitable result of pure attraction
- Explains orbital infall (don't need retarded gravity theory and "gravitational waves")
- One candidate mechanism for cosmic redshift (tiredlight_Zwicky, photon hubbling)


---
### More info
- [Wikipedia: Dynamical friction](https://en.wikipedia.org/wiki/Dynamical_friction)

---
### Run
- Open `index.html`
