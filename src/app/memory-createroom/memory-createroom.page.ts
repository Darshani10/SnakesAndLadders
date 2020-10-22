import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MemoryCreateroomService } from './memory-createroom.service';

@Component({
  selector: 'app-memory-createroom',
  templateUrl: './memory-createroom.page.html',
  styleUrls: ['./memory-createroom.page.scss'],
})
export class MemoryCreateroomPage implements OnInit {
  roomT: string;

  constructor(public crService: MemoryCreateroomService, private route: ActivatedRoute) {}
  
  Audio(){
    const audio = new Audio('../assets/button-click.mpeg'); // audio play on flip of card
    audio.play();
  }

  ngOnInit() {
    this.roomT = this.route.snapshot.queryParamMap.get('room');
    this.crService.listenPlayers(this.roomT);
    this.crService.checkButton();
    this.crService.navigator();
    }
}