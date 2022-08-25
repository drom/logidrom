'use strict';

global.App = div => {
  if (typeof div === 'string') {
    div = document.getElementById(div);
  }
  console.log(div);
};

/* eslint-env browser */
