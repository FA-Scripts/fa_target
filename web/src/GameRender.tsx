import { useEffect, useRef } from "react";

// Cfx game-view texture hook, adapted from liquiad's GameRender.tsx:
// https://gist.github.com/liquiad/f4952575cbff31f923d19b342b4d25f8
// Sample only the panel's screen rectangle; CSS backdrop-filter cannot read GTA.
export function GameRender({ blur }: { blur: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
    });
    if (!gl) return;
    const shaders: WebGLShader[] = [];
    let frame = 0;
    const program = gl.createProgram();
    const texture = gl.createTexture();
    const buffer = gl.createBuffer();
    const dispose = () => {
      cancelAnimationFrame(frame);
      gl.deleteBuffer(buffer);
      gl.deleteTexture(texture);
      gl.deleteProgram(program);
      shaders.forEach((shader) => gl.deleteShader(shader));
    };
    try {
      if (!program || !texture || !buffer)
        throw new Error("WebGL allocation failed");
      const compile = (type: number, source: string) => {
        const shader = gl.createShader(type);
        if (!shader) throw new Error("Shader allocation failed");
        shaders.push(shader);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
          throw new Error(
            gl.getShaderInfoLog(shader) ?? "Shader compilation failed",
          );
        gl.attachShader(program, shader);
      };
      compile(
        gl.VERTEX_SHADER,
        `attribute vec2 position; varying vec2 uv;
        void main(){ uv = position * .5 + .5; gl_Position=vec4(position,0.,1.); }`,
      );
      compile(
        gl.FRAGMENT_SHADER,
        `precision mediump float;
        varying vec2 uv; uniform sampler2D game; uniform vec4 rect; uniform vec2 stepSize;
        void main(){
          vec2 point = rect.xy + vec2(uv.x, 1. - uv.y) * rect.zw;
          vec4 color = vec4(0.); float total = 0.;
          for(int x=-2;x<=2;x++){ for(int y=-2;y<=2;y++){
            float weight = exp(-float(x*x+y*y)/2.);
            color += texture2D(game, clamp(point + vec2(float(x),float(y))*stepSize,vec2(0.),vec2(1.))) * weight;
            total += weight;
          }}
          gl_FragColor = color/total;
        }`,
      );
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        throw new Error(gl.getProgramInfoLog(program) ?? "Shader link failed");
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      // Transparent fallback if the Cfx hook is unavailable.
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array(4),
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      for (const wrap of [
        gl.CLAMP_TO_EDGE,
        gl.MIRRORED_REPEAT,
        gl.REPEAT,
        gl.CLAMP_TO_EDGE,
      ])
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
      gl.uniform1i(gl.getUniformLocation(program, "game"), 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
        gl.STATIC_DRAW,
      );
      const position = gl.getAttribLocation(program, "position");
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      const rectUniform = gl.getUniformLocation(program, "rect");
      const stepUniform = gl.getUniformLocation(program, "stepSize");
      const render = () => {
        const rect = canvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && !document.hidden) {
          const width = Math.ceil(rect.width),
            height = Math.ceil(rect.height);
          if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
          }
          gl.viewport(0, 0, width, height);
          gl.uniform4f(
            rectUniform,
            rect.left / window.innerWidth,
            rect.top / window.innerHeight,
            rect.width / window.innerWidth,
            rect.height / window.innerHeight,
          );
          gl.uniform2f(
            stepUniform,
            blur / window.innerWidth / 2,
            blur / window.innerHeight / 2,
          );
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }
        frame = requestAnimationFrame(render);
      };
      const lost = (event: Event) => {
        event.preventDefault();
        cancelAnimationFrame(frame);
      };
      canvas.addEventListener("webglcontextlost", lost);
      render();
      return () => {
        canvas.removeEventListener("webglcontextlost", lost);
        dispose();
      };
    } catch (error) {
      console.warn("FA Target: game blur unavailable", error);
      dispose();
    }
  }, [blur]);
  return <canvas ref={ref} className="game-blur" aria-hidden="true" />;
}
