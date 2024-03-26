import * as Blockly from "blockly";
import { ConstantProvider } from "./constants";

const DOTTED_OUTLINE_HOVER_CLASS = "blockly-dotted-outline-on-hover"
const HOVER_CLASS = "hover"

export class PathObject extends Blockly.zelos.PathObject {
    static CONNECTION_INDICATOR_RADIUS = 9;

    protected svgPathHighlighted: SVGElement;
    protected hasError: boolean;

    protected hasDottedOutlineOnHover: boolean;

    protected mouseOverData: Blockly.browserEvents.Data;
    protected mouseLeaveData: Blockly.browserEvents.Data;

    protected connectionPointIndicators = new WeakMap<Blockly.RenderedConnection, SVGElement>();


    override updateHighlighted(enable: boolean) {
        // this.setClass_('blocklySelected', enable);
        if (enable) {
            if (!this.svgPathHighlighted) {
                const constants = this.constants as ConstantProvider;
                const filterId = this.hasError ? constants.errorOutlineFilterId : constants.highlightOutlineFilterId;
                this.svgPathHighlighted = this.svgPath.cloneNode(true) as SVGElement;
                this.svgPathHighlighted.setAttribute('fill', 'none');
                this.svgPathHighlighted.setAttribute(
                    'filter',
                    'url(#' + filterId + ')',
                );
                this.svgRoot.appendChild(this.svgPathHighlighted);
            }
        } else {
            if (this.svgPathHighlighted) {
                this.svgRoot.removeChild(this.svgPathHighlighted);
                this.svgPathHighlighted = null;
            }
        }
    }

    override updateSelected(enable: boolean): void {
        if (enable) {
            this.svgPath.classList.remove(HOVER_CLASS);
        }
        super.updateSelected(enable);
    }

    override addConnectionHighlight(connection: Blockly.RenderedConnection, connectionPath: string, offset: Blockly.utils.Coordinate, rtl: boolean): void {
        super.addConnectionHighlight(connection, connectionPath, offset, rtl);

        if (connection.type === Blockly.INPUT_VALUE || connection.type === Blockly.OUTPUT_VALUE) {
            const indicator = Blockly.utils.dom.createSvgElement('g',
                { 'class': 'blocklyInputConnectionIndicator' }
            );
            Blockly.utils.dom.createSvgElement('circle',
                { 'r': PathObject.CONNECTION_INDICATOR_RADIUS }, indicator);

            const offset = connection.getOffsetInBlock();
            indicator.setAttribute('transform',
                'translate(' + offset.x + ',' + offset.y + ')');
            this.connectionPointIndicators.set(connection, indicator);
            this.svgRoot.appendChild(indicator);
        }
    }

    override removeConnectionHighlight(connection: Blockly.RenderedConnection): void {
        super.removeConnectionHighlight(connection);

        if (this.connectionPointIndicators.has(connection)) {
            this.connectionPointIndicators.get(connection).remove();
            this.connectionPointIndicators.delete(connection);
        }
    }

    override applyColour(block: Blockly.BlockSvg): void {
        super.applyColour(block);

        // For dark shadow blocks, add a lighter border to differentiate
        if (block.isShadow() && block.getParent()) {
            const colour = block.getParent().style.colourTertiary;
            const rgb = Blockly.utils.colour.hexToRgb(colour);
            const luminance = calculateLuminance(rgb);
            if (luminance < 0.15) {
                this.svgPath.setAttribute('stroke', Blockly.utils.colour.blend("#ffffff", colour, 0.3));
            }
        }
    }

    setHasDottedOutllineOnHover(enabled: boolean) {
        this.hasDottedOutlineOnHover = enabled;

        if (enabled) {
            this.svgPath.classList.add(DOTTED_OUTLINE_HOVER_CLASS);
            if (!this.mouseOverData) {
                this.mouseOverData = Blockly.browserEvents.bind(
                    this.svgRoot,
                    "mouseover",
                    this,
                    () => {
                        this.svgPath.classList.add(HOVER_CLASS);
                    }
                );
                this.mouseLeaveData = Blockly.browserEvents.bind(
                    this.svgRoot,
                    "mouseleave",
                    this,
                    () => {
                        this.svgPath.classList.remove(HOVER_CLASS);
                    }
                );
            }
        }
        else {
            this.svgPath.classList.remove(DOTTED_OUTLINE_HOVER_CLASS);
            if (this.mouseOverData) {
                Blockly.browserEvents.unbind(this.mouseOverData);
                Blockly.browserEvents.unbind(this.mouseLeaveData);

                this.mouseOverData = undefined;
                this.mouseLeaveData = undefined;
            }
            this.svgPath.classList.remove(DOTTED_OUTLINE_HOVER_CLASS);
        }
    }

    setHasError(hasError: boolean) {
        this.hasError = hasError;
    }

    isHighlighted() {
        return !!this.svgPathHighlighted;
    }

    resizeHighlight() {
        if (this.svgPathHighlighted) {
            this.updateHighlighted(false);
            this.updateHighlighted(true);
        }
    }
}

function calculateLuminance(rgb: number[]) {
    return ((0.2126 * rgb[0]) + (0.7152 * rgb[1]) + (0.0722 * rgb[2])) / 255;
}

Blockly.Css.register(`
.blockly-dotted-outline-on-hover {
    transition: stroke .4s;
}
.blockly-dotted-outline-on-hover.hover {
    stroke-dasharray: 2;
    stroke: white;
    stroke-width: 2;
}
`)