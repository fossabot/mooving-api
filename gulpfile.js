const gulp = require('gulp');
const jest = require('gulp-jest').default;
const nodemon = require('gulp-nodemon')
const ts = require('gulp-typescript');
const tslint = require('gulp-tslint');
const spellcheck = require('gulp-ts-spellcheck').default;

gulp.task('jest', (done) => {
  return gulp.src('')
    .on('error', function (err) { done(err); })
    .pipe(jest({ runInBand: true }));
});

gulp.task('tslint', (done) => {
  return gulp.src('src/**/*.ts')
    .on('error', function (err) { done(err); })
    .pipe(tslint({
      formatter: 'prose'
    }))
    .pipe(tslint.report());
});

gulp.task('tsc', function (done) {
  const tsProject = ts.createProject('tsconfig.json');
  return tsProject.src()
    .pipe(tsProject())
    .on('error', function (err) { done(err); })
    .js
    .pipe(gulp.dest('build'));
});

gulp.task('spellcheck', function (done) {
  return gulp.src('src/**/*.ts')
    .on('error', function (err) {
      done(err);
    })
    .pipe(spellcheck({
      dictionary: require('./speller-dictionary.js')
    }))
    .pipe(spellcheck.report({}));
});

gulp.task('start-driver', function (done) {
  nodemon({
    watch: ['src'],
    ignore: ['src/**/*.test.ts'],
    exec: 'ts-node ./src/driver/index.ts',
    ext: 'ts',
    done: done
  })
})

gulp.task('start-rider', function (done) {
  nodemon({
    watch: ['src'],
    ignore: ['src/**/*.test.ts'],
    exec: 'ts-node ./src/rider/index.ts',
    ext: 'ts',
    done: done
  })
})

gulp.task('start-ops', function (done) {
  nodemon({
    watch: ['src'],
    ignore: ['src/**/*.test.ts'],
    exec: 'ts-node ./src/owner/index.ts',
    ext: 'ts',
    done: done
  })
})

gulp.task('compile', ['tslint', 'tsc']);
gulp.task('test', ['compile', 'jest']);
