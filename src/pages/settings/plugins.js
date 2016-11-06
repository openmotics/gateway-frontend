/*
 * Copyright (C) 2016 OpenMotics BVBA
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
import $ from "jquery";
import {computedFrom} from "aurelia-framework";
import {Base} from "../../resources/base";
import Shared from "../../components/shared";
import {Refresher} from "../../components/refresher";
import {Toolbox} from "../../components/toolbox";
import {Plugin} from "../../containers/plugin";

export class Plugins extends Base {
    constructor() {
        super();
        this.api = Shared.get('api');
        this.signaler = Shared.get('signaler');
        this.refresher = new Refresher(() => {
            this.loadPlugins().then(() => {
                this.signaler.signal('reload-plugins');
            });
        }, 60000);

        this.plugins = [];
        this.pluginsLoading = true;
        this.activePlugin = undefined;
        this.requestedRemove = false;
        this.installMessage = '';
    };

    @computedFrom
    get allPlugins() {
        let plugins = [];
        for (let plugin of this.plugins) {
            plugins.push(plugin);
        }
        return plugins;
    }

    loadPlugins() {
        return this.api.getPlugins()
            .then((data) => {
                Toolbox.crossfiller(data.plugins, this.plugins, 'name', (name) => {
                    let plugin = new Plugin(name);
                    plugin.initializeConfig();
                    return plugin;
                });
                this.plugins.sort((a, b) => {
                    return a.name > b.name ? 1 : -1;
                });
                if (this.activePlugin === undefined && this.plugins.length > 0) {
                    this.selectPlugin(this.plugins[0]);
                }
                this.pluginsLoading = false;
            })
            .catch((error) => {
                if (!this.api.isDeduplicated(error)) {
                    console.error('Could not load Plugins');
                }
            });
    };

    selectPlugin(plugin) {
        if (this.activePlugin !== undefined) {
            this.activePlugin.stopLogWatcher();
        }
        this.activePlugin = plugin;
        this.activePlugin.startLogWatcher();
    }

    requestRemove() {
        this.requestedRemove = true;
    }

    confirmRemove() {
        if (this.requestedRemove === true) {
            this.activePlugin.remove()
                .then(() => {
                    this.requestedRemove = false;
                    this.plugins.remove(this.activePlugin);
                    this.activePlugin = this.plugins[0];
                });
        }
    }

    abortRemove() {
        this.requestedRemove = false;
    }

    installPlugin() {
        this.installMessage = '';
        let _this = this;
        $('#install-plugin-token').val(this.api.token);
        $('#upload-frame').off('load.install-plugin').on('load.install-plugin', function () {
            let result = this.contentWindow.document.body.innerHTML;
            if (result.contains('Plugin successfully installed')) {
                _this.installMessage = _this.i18n.tr('pages.settings.plugins.installok');
            } else {
                _this.installMessage = _this.i18n.tr('pages.settings.plugins.installfailed');
            }
        });
        let form = $('#upload-plugin');
        form.attr('action', this.api.endpoint + 'install_plugin');
        form.submit();
    }

    // Aurelia
    attached() {
        super.attached();
    };

    activate() {
        this.refresher.run();
        this.refresher.start();
        if (this.activePlugin !== undefined) {
            this.activePlugin.startLogWatcher();
        }
    };

    deactivate() {
        this.refresher.stop();
        if (this.activePlugin !== undefined) {
            this.activePlugin.stopLogWatcher();
        }
    }
}