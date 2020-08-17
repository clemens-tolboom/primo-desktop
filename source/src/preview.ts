import {ComponentPreview,MultiPreview,SinglePreview} from 'primo-app'

let app
const isMultiPreview = window.location.pathname.includes('multi')
const params = new URL(window.location.href).searchParams
const preview = params.get('preview')
const previewId = params.get('page')

if (preview === 'multiple') {
	console.log('single')
	app = new MultiPreview({
		target: document.body
	});
} else if (preview === 'single' && previewId) {
	console.log('single')
  app = new SinglePreview({
    target: document.body,
    props: { previewId },
  })
} else if (preview === 'single') {
	console.log('component')
	app = new ComponentPreview({
		target: document.body
	});
} else {
	console.error('could not load preview')
}


export default app;