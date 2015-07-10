'use strict';

module.exports = function(grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        eslint: {
            all: ['Gruntfile.js', 'lib/*.js']
        },
        mochaTest: {
            test: {
                src: ['test/*.js']
            }
        },
        mocha_istanbul: {
            coverage: {
                src: 'test'
            }
        },
        coveralls: {
            your_target: {
                src: 'coverage/lcov.info'
            }
        }
    });

    grunt.loadNpmTasks('grunt-eslint');
    grunt.loadNpmTasks('grunt-mocha-test');
    grunt.loadNpmTasks('grunt-mocha-istanbul');
    grunt.loadNpmTasks('grunt-coveralls');

    grunt.registerTask('mocha', ['mochaTest']);
    grunt.registerTask('coverage', ['mocha_istanbul:coverage']);
    grunt.registerTask('default', ['eslint', 'coverage', 'coveralls']);
};
