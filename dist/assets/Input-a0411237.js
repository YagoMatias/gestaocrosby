import{r as i,j as s,S as Q,z as U}from"./index-44fad1e9.js";const W=i.memo(i.forwardRef(({type:t="text",label:f,placeholder:$,value:a,onChange:N,onBlur:l,onFocus:d,disabled:c=!1,required:b=!1,error:e,helperText:x,leftIcon:m,rightIcon:u,size:v="md",fullWidth:I=!1,className:S="",containerClassName:z="",id:C,name:h,autoComplete:k,maxLength:r,minLength:P,pattern:E,...M},R)=>{const[o,F]=i.useState(!1),[O,g]=i.useState(!1),n=C||`input-${h||Math.random().toString(36).substr(2,9)}`,y=e?`${n}-error`:void 0,j=x?`${n}-helper`:void 0,w={sm:"px-3 py-1.5 text-sm",md:"px-3 py-2 text-sm",lg:"px-4 py-3 text-base"},V=`
    block w-full rounded-lg border transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-offset-0
    disabled:opacity-50 disabled:cursor-not-allowed
    ${w[v]||w.md}
    ${e?"border-red-300 focus:border-red-500 focus:ring-red-500":O?"border-[#000638] focus:border-[#000638] focus:ring-[#000638]":"border-gray-300 focus:border-[#000638] focus:ring-[#000638]"}
    ${c?"bg-gray-50":"bg-white"}
    ${m?"pl-10":""}
    ${u||t==="password"?"pr-10":""}
    ${S}
  `,A=`
    ${I?"w-full":""}
    ${z}
  `,D=`
    block text-sm font-medium mb-1
    ${e?"text-red-700":"text-gray-700"}
    ${b?"after:content-['*'] after:ml-0.5 after:text-red-500":""}
  `,G=p=>{g(!0),d==null||d(p)},H=p=>{g(!1),l==null||l(p)},J=()=>{F(!o)},K=t==="password"&&o?"text":t;return s.jsxs("div",{className:A,children:[f&&s.jsx("label",{htmlFor:n,className:D,children:f}),s.jsxs("div",{className:"relative",children:[m&&s.jsx("div",{className:"absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none",children:s.jsx("span",{className:"text-gray-400","aria-hidden":"true",children:m})}),s.jsx("input",{ref:R,id:n,name:h,type:K,value:a,onChange:N,onFocus:G,onBlur:H,disabled:c,required:b,placeholder:$,className:V,autoComplete:k,maxLength:r,minLength:P,pattern:E,"aria-invalid":!!e,"aria-describedby":[y,j].filter(Boolean).join(" ")||void 0,...M}),(u||t==="password")&&s.jsx("div",{className:"absolute inset-y-0 right-0 pr-3 flex items-center",children:t==="password"?s.jsx("button",{type:"button",onClick:J,className:"text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600 transition-colors","aria-label":o?"Ocultar senha":"Mostrar senha",tabIndex:c?-1:0,children:o?s.jsx(Q,{size:20}):s.jsx(U,{size:20})}):s.jsx("span",{className:"text-gray-400","aria-hidden":"true",children:u})})]}),x&&!e&&s.jsx("p",{id:j,className:"mt-1 text-sm text-gray-500",children:x}),e&&s.jsx("p",{id:y,className:"mt-1 text-sm text-red-600",role:"alert",children:e}),r&&a&&s.jsx("div",{className:"mt-1 text-right",children:s.jsxs("span",{className:`text-xs ${a.length>r*.9?"text-yellow-600":a.length===r?"text-red-600":"text-gray-500"}`,children:[a.length,"/",r]})})]})}));W.displayName="Input";export{W as I};
