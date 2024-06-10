import ExecutionEnvironment from '@docusaurus/ExecutionEnvironment';
import mitt from 'mitt';

const emitter = mitt();

if (ExecutionEnvironment.canUseDOM) {
  window.emitter = emitter;
}

export function onRouteDidUpdate() {
  if (ExecutionEnvironment.canUseDOM) {
    setTimeout(() => {
      window.emitter.emit('onRouteDidUpdate');
    });
  }
  // https://github.com/facebook/docusaurus/issues/8278
}