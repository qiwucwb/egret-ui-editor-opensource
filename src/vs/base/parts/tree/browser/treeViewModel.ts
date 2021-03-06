/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EventEmitter } from 'vs/base/common/eventEmitter';
import { IIterator, ArrayIterator } from 'vs/base/common/iterator';
import { Item } from './treeModel';

export interface IViewItem {
	model: Item;
	top: number;
	height: number;
}

export class HeightMap extends EventEmitter {

	private heightMap: IViewItem[];
	private indexes: { [item: string]: number; };

	constructor() {
		super();

		this.heightMap = [];
		this.indexes = {};
	}

	public getTotalHeight(): number {
		const last = this.heightMap[this.heightMap.length - 1];
		return !last ? 0 : last.top + last.height;
	}

	public onInsertItems(iterator: IIterator<Item>, afterItemId: string = null): number {
		let item: Item;
		let viewItem: IViewItem;
		let i: number, j: number;
		let totalSize: number;
		let sizeDiff = 0;

		if (afterItemId === null) {
			i = 0;
			totalSize = 0;
		} else {
			i = this.indexes[afterItemId] + 1;
			viewItem = this.heightMap[i - 1];

			if (!viewItem) {
				console.error('view item doesnt exist');
				return undefined;
			}

			totalSize = viewItem.top + viewItem.height;
		}

		const boundSplice = this.heightMap.splice.bind(this.heightMap, i, 0);

		const itemsToInsert: IViewItem[] = [];

		while (item = iterator.next()) {
			viewItem = this.createViewItem(item);
			viewItem.top = totalSize + sizeDiff;
			this.emit('viewItem:create', { item: viewItem.model });

			this.indexes[item.id] = i++;
			itemsToInsert.push(viewItem);
			sizeDiff += viewItem.height;
		}

		boundSplice.apply(this.heightMap, itemsToInsert);

		for (j = i; j < this.heightMap.length; j++) {
			viewItem = this.heightMap[j];
			viewItem.top += sizeDiff;
			this.indexes[viewItem.model.id] = j;
		}

		for (j = itemsToInsert.length - 1; j >= 0; j--) {
			this.onInsertItem(itemsToInsert[j]);
		}

		for (j = this.heightMap.length - 1; j >= i; j--) {
			this.onRefreshItem(this.heightMap[j]);
		}

		return sizeDiff;
	}

	public onInsertItem(item: IViewItem): void {
		// noop
	}

	// Contiguous items
	public onRemoveItems(iterator: IIterator<string>): void {
		let itemId: string;
		let viewItem: IViewItem;
		let startIndex: number = null;
		let i: number;
		let sizeDiff = 0;

		while (itemId = iterator.next()) {
			i = this.indexes[itemId];
			viewItem = this.heightMap[i];

			if (!viewItem) {
				console.error('view item doesnt exist');
				return;
			}

			sizeDiff -= viewItem.height;
			delete this.indexes[itemId];
			this.onRemoveItem(viewItem);

			if (startIndex === null) {
				startIndex = i;
			}
		}

		if (sizeDiff === 0) {
			return;
		}

		this.heightMap.splice(startIndex, i - startIndex + 1);

		for (i = startIndex; i < this.heightMap.length; i++) {
			viewItem = this.heightMap[i];
			viewItem.top += sizeDiff;
			this.indexes[viewItem.model.id] = i;
			this.onRefreshItem(viewItem);
		}
	}

	public onRemoveItem(item: IViewItem): void {
		// noop
	}

	public onRefreshItemSet(items: Item[]): void {
		const sortedItems = items.sort((a, b) => this.indexes[a.id] - this.indexes[b.id]);
		this.onRefreshItems(new ArrayIterator(sortedItems));
	}

	// Ordered, but not necessarily contiguous items
	public onRefreshItems(iterator: IIterator<Item>): void {
		let item: Item;
		let viewItem: IViewItem;
		let newHeight: number;
		let i: number, j: number = null;
		let cummDiff = 0;

		while (item = iterator.next()) {
			i = this.indexes[item.id];

			for (; cummDiff !== 0 && j !== null && j < i; j++) {
				viewItem = this.heightMap[j];
				viewItem.top += cummDiff;
				this.onRefreshItem(viewItem);
			}

			viewItem = this.heightMap[i];
			newHeight = item.getHeight();
			viewItem.top += cummDiff;
			cummDiff += newHeight - viewItem.height;
			viewItem.height = newHeight;
			this.onRefreshItem(viewItem, true);

			j = i + 1;
		}

		if (cummDiff !== 0 && j !== null) {
			for (; j < this.heightMap.length; j++) {
				viewItem = this.heightMap[j];
				viewItem.top += cummDiff;
				this.onRefreshItem(viewItem);
			}
		}
	}

	public onRefreshItem(item: IViewItem, needsRender: boolean = false): void {
		// noop
	}

	public itemsCount(): number {
		return this.heightMap.length;
	}

	public itemAt(position: number): string {
		return this.heightMap[this.indexAt(position)].model.id;
	}

	public withItemsInRange(start: number, end: number, fn: (item: string) => void): void {
		start = this.indexAt(start);
		end = this.indexAt(end);
		for (let i = start; i <= end; i++) {
			fn(this.heightMap[i].model.id);
		}
	}

	public indexAt(position: number): number {
		let left = 0;
		let right = this.heightMap.length;
		let center: number;
		let item: IViewItem;

		// Binary search
		while (left < right) {
			center = Math.floor((left + right) / 2);
			item = this.heightMap[center];

			if (position < item.top) {
				right = center;
			} else if (position >= item.top + item.height) {
				if (left === center) {
					break;
				}
				left = center;
			} else {
				return center;
			}
		}

		return this.heightMap.length;
	}

	public indexAfter(position: number): number {
		return Math.min(this.indexAt(position) + 1, this.heightMap.length);
	}

	public itemAtIndex(index: number): IViewItem {
		return this.heightMap[index];
	}

	public itemAfter(item: IViewItem): IViewItem {
		return this.heightMap[this.indexes[item.model.id] + 1] || null;
	}

	protected createViewItem(item: Item): IViewItem {
		throw new Error('not implemented');
	}

	public dispose(): void {
		this.heightMap = null;
		this.indexes = null;
	}
}